# PR-7 Delete/Edit + backup — file plan (plan only, no code)

Source: `stage2-design.md` §3.7 · §5.1 · §5.6 · §6 row PR-7 · `stage1-requirements.md` REQ-E1/E2 · `pr-execution-queue.md` row 7 · constraints `cursor-continue-119-to-end.md` (skip PR-0/PR-12 egress; PR-14 last; no `FORCE`/`SKIP_DRAIN`; canary Bale **4858359991** only; **DB backup before migrations**).
Gate: **CODE** · **depends on PR-6** (audit + roles + Owner/`goRef` on withdraw-class actions). **Owner-gated:** written GO before merge/deploy; **Postgres backup on Iran** before migration; **one live delete** smoke on Bale canary destination only.

## 0. Headline finding

**Remote DELETE/UPDATE already run in the worker; admin UX and safety rails do not match stage2.** `withdraw()` / `bulkWithdraw()` mark `omnichannel_publications.status = WITHDRAWN`, audit, and (when connectors are on) enqueue `DELETE` deliveries for every live `providerMessageId` from `liveRemoteMessages()` / `foldLiveRemoteMessages()`. Adapters implement `update`/`delete` (album IDs as comma-separated `providerMessageId`; Bale enforces **48h** delete window). There is **no** `post_backup` or `delivery_message` table, **no** delivery-level `WITHDRAWN`, **no** message-selective delete, **no** `edit`/`revert` admin endpoints, and **no** two-step confirm (SKU + backup preview). PR-7 is a **delta PR**: persist backup snapshots, normalize message IDs for albums, expose stage2 APIs with **PR-6 RBAC** (delete Owner + `goRef`; edit Publisher + audit), unify withdraw with the same backup+delete pipeline, and prove rollback via backup — without coverage UI (PR-8), composer (PR-9), egress/vault (PR-12), or bots (PR-14).

## 1. Invariants (must hold after PR-7)

- **Shared monolith:** stock/price/inventory unchanged; connectors stay off in CI; no new `OMNICHANNEL_*` send flags.
- **No stock from connectors:** delete/edit only touch messenger + delivery/publication metadata; never `retailStock` / `wholesaleStock` / legacy `stock`.
- **Idempotency (PR-3):** DELETE uses `DELETE:{destinationId}:{messageId}:`; duplicate delete requests collapse; adapter “already gone” remains no-op (telegram/bale/rubika specs).
- **Withdrawn publication gate:** worker must not CREATE/UPDATE when `isPublicationWithdrawn` — unchanged; new deletes must not resurrect live posts without explicit reopen/republish flows (PR-8/9).
- **Backup before irreversible remote DELETE:** snapshot caption, media URLs, message IDs, destination, `contentHash`, actor, reason — **before** enqueue or synchronous canary delete.
- **Secrets:** backup and audit never store tokens; scrub URLs if they embed secrets.
- **RBAC (PR-6):** delete paths require **OWNER** + non-empty **`goRef`** when `OMNICHANNEL_RBAC_ENABLED=true`; edit/revert require **PUBLISHER** minimum; Viewer → 403.
- **Canary / prod test:** at most **one** live delete on Bale canary chat **4858359991**; no Telegram/Rubika/production channel deletes in automated smoke.
- **Migration:** additive only; **owner runs** `scripts/backup-postgres.sh` on Iran and records path in session report before apply.

## 2. Existing behavior vs stage2 gaps

### 2.1 What exists

| Piece | Location | Behavior today |
| --- | --- | --- |
| Publication withdraw | `omnichannel.service.ts` → `withdraw` / `bulkWithdraw` | Sets publication(s) `WITHDRAWN`; enqueues DELETE per live message when connectors enabled |
| Live message resolution | `liveRemoteMessages`, `foldLiveRemoteMessages` | One logical post per destination; album = comma-separated IDs in one delivery row |
| Worker DELETE/UPDATE | `outbox-worker.service.ts` | Adapter call; `supersedeCreatesAfterDelete` after DELETE success |
| Adapters | `telegram.adapter.ts`, `bale.adapter.ts`, `rubika.adapter.ts` | Multi-ID delete; Bale `delete_window_expired`; edit no-op on “not modified” |
| Admin routes | `POST publications/:id/withdraw`, `bulk-withdraw` | Reason only; no backup preview, no per-message selection, no SKU confirm |
| Delivery row | `publication-delivery.entity.ts` | Single `providerMessageId`; `contentHash`; statuses include HOLD via `deferredReason` |
| Audit | PR-6 era `audit()` | `withdraw` logged; no structured backup id / per-message results |

### 2.2 Gaps vs REQ-E1 / REQ-E2 / stage2 §3.7

| Requirement | Gap |
| --- | --- |
| REQ-E1 selective delete + backup + two-step + per-message result + Bale 48h warning | Only coarse publication withdraw |
| REQ-E2 edit on same messageId + diff + revert | UPDATE only via catalog/automation enqueue — no admin edit/revert API |
| `post_backup` table | Missing |
| `delivery_message` (album index) | Missing; albums only in CSV `providerMessageId` |
| Delivery status `WITHDRAWN` (D11) | Only publication `WITHDRAWN`; successful DELETE leaves CREATE row `SUCCEEDED` + supersede logic |
| UI two-step (backup preview, type SKU) | `AdminOmnichannel.tsx` has bulk withdraw confirm — not stage2 flow |
| GO-ref on delete | Depends on PR-6; withdraw must align with Owner + `goRef` |

## 3. Target API (implementer contract)

Align paths with `stage2-design.md` §5.6 under existing prefix ` /v1/omnichannel` (controller naming may use kebab segments).

| Method | Path | Role | Purpose |
| --- | --- | --- | --- |
| GET | `deliveries/:deliveryId/delete-plan` | PUBLISHER+ | Dry: selected message IDs (default all in row), backup preview, Bale age warning, idempotency keys |
| POST | `deliveries/:deliveryId/messages/delete` | OWNER + `goRef` | Body: `messageIds[]`, `reason`, `confirmSku` (must match product SKU when `sourceType=PRODUCT`) → enqueue DELETE(s) or execute if inline canary flag; returns `{ results: [{ messageId, ok, error? }] }` |
| POST | `deliveries/:deliveryId/edit` | PUBLISHER | Body: new caption/text (+ optional media override refs); builds UPDATE payload + `contentHash`; shows diff vs last backup or rendered snapshot |
| POST | `deliveries/:deliveryId/revert` | PUBLISHER | Body: `backupId` or “last”; enqueues UPDATE to restored snapshot |
| POST | `publications/:id/withdraw` | OWNER + `goRef` (PR-6) | **Behavior change:** call shared pipeline (backup all live messages, then DELETE enqueue) — same as today but with backups |

**Album rule:** `messageIds` must be subset of parsed IDs from delivery’s `providerMessageId`; deleting subset may leave orphan album parts — default **reject partial album delete** unless provider capability documents safe subset (Telegram/Bale: delete **all** IDs in one action).

## 4. Data model (migrations)

Additive migration e.g. `20261028-002-omnichannel-post-backup.ts` (date suffix per repo convention at implement time).

### 4.1 `omnichannel_post_backups`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `deliveryId` | uuid FK → `omnichannel_publication_deliveries` RESTRICT | |
| `publicationId` | uuid | denormalized for queries |
| `destinationId` | uuid | |
| `kind` | varchar | `pre_delete` \| `pre_edit` \| `post_edit` |
| `caption` | text nullable | redacted max length |
| `mediaUrls` | jsonb | array of strings |
| `messageIds` | jsonb | string[] (normalized) |
| `contentHash` | varchar nullable | |
| `reason` | text nullable | |
| `actorId` | uuid | |
| `goRef` | varchar nullable | delete only |
| `createdAt` | timestamptz | |

Index: `(deliveryId, createdAt DESC)`. **Retention (D16):** no purge job in PR-7; optional future cron — document default **keep indefinitely** until owner sets policy.

### 4.2 `omnichannel_delivery_messages` (minimal)

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `deliveryId` | uuid FK | |
| `providerMessageId` | varchar | |
| `albumIndex` | int default 0 | |
| `deletedAt` | timestamptz nullable | set when DELETE succeeds for this id |

**Backfill strategy:** on read/write, if no child rows, split `providerMessageId` on `,` and insert rows idempotently (migration backfill optional for SUCCEEDED CREATE rows only — low row count).

### 4.3 Delivery status `WITHDRAWN` (D11)

- Extend allowed `status` on `omnichannel_publication_deliveries` (app constant + UI later).
- When **all** messages for a SUCCEEDED CREATE delivery are deleted successfully → set delivery `status = WITHDRAWN'` (not DEAD).
- Failed delete → leave delivery SUCCEEDED; result row error `delete_window_expired` / provider text.
- Partial failure on multi-ID → delivery stays SUCCEEDED; backup retained; audit lists per-id outcomes.

**Do not** add `hold_reason` / `warning_code` columns in PR-7 unless already planned elsewhere — use existing `deferredReason` / logs for HOLD paths.

## 5. Service boundaries

| Module | Responsibility |
| --- | --- |
| `omnichannel-delete.service.ts` (NEW) | Plan, backup insert, enqueue DELETE, Bale age check from `sentAt`, parse message IDs |
| `omnichannel-edit.service.ts` (NEW) | Diff, backup, enqueue UPDATE, revert from backup |
| `omnichannel.service.ts` | Thin delegate; **refactor** `withdraw` to call delete service; keep `liveRemoteMessages` / enqueue |
| `outbox-worker.service.ts` | **Narrow edit only:** after DELETE success, mark `delivery_messages.deletedAt`, set delivery WITHDRAWN when all gone; persist `post_backup` reference in audit payload — no change to claim/idempotency |
| `AdminOmnichannel.tsx` | **Optional:** delete-plan drawer + SKU confirm — API enforcement mandatory |

Extract shared helper: `parseProviderMessageIds(providerMessageId: string): string[]`.

## 6. Acceptance criteria (testable)

1. **Backup:** every successful `POST .../messages/delete` and every `withdraw` that enqueues DELETE has a `omnichannel_post_backups` row with matching `messageIds` and caption/media from last known render (fixture/mock adapter in unit tests).
2. **RBAC:** with RBAC on, Publisher → delete **403**; Owner without `goRef` → **400**; Owner with `goRef` → **200** (mocked adapter).
3. **Two-step:** delete without matching `confirmSku` for PRODUCT delivery → **400** with Persian message.
4. **Per-message results:** album with 3 IDs, one simulated Bale `delete_window_expired` → `{ results: [ok, ok, error] }`, delivery remains SUCCEEDED, backup kept.
5. **Idempotency:** duplicate delete request while DELETE pending → single active DELETE row (PR-3 index).
6. **Edit:** `POST edit` on SUCCEEDED CREATE enqueues UPDATE with same primary `providerMessageId`, new `contentHash`; worker path uses existing UPDATE branch (mock).
7. **Revert:** `POST revert` restores caption from chosen backup; audit `delivery_revert` with backup id.
8. **Withdraw integration:** `withdraw` creates backups for all live destinations before enqueue; publication `WITHDRAWN` unchanged.
9. **No connector in CI:** with connectors disabled, delete-plan returns preview; live delete returns **503** or `connectors_disabled` without calling adapter (consistent with existing publish gates).
10. **Phase acceptance spec** strings for new routes + `WITHDRAWN` delivery status in constants.

## 7. Files to claim (implementer)

Register in `.ai-dos/tasks/active.yaml`: owner, branch `feat/omnichannel-pr7-delete-edit-backup`, worktree, files below. **Start after PR-6 merged on master.**

| File | Action |
| --- | --- |
| `database/migrations/*-omnichannel-post-backup.ts` | NEW — tables §4 |
| `database/migrations/*-omnichannel-post-backup.spec.ts` | NEW |
| `modules/omnichannel/entities/omnichannel-post-backup.entity.ts` | NEW |
| `modules/omnichannel/entities/omnichannel-delivery-message.entity.ts` | NEW |
| `modules/omnichannel/entities/publication-delivery.entity.ts` | EDIT — relation optional; document WITHDRAWN status |
| `modules/omnichannel/omnichannel.constants.ts` | EDIT — delivery status WITHDRAWN |
| `modules/omnichannel/dto/omnichannel-delete-edit.dto.ts` | NEW — validation, confirmSku, goRef |
| `modules/omnichannel/services/omnichannel-delete.service.ts` | NEW |
| `modules/omnichannel/services/omnichannel-edit.service.ts` | NEW |
| `modules/omnichannel/services/omnichannel-delete.service.spec.ts` | NEW |
| `modules/omnichannel/services/omnichannel-edit.service.spec.ts` | NEW |
| `modules/omnichannel/services/omnichannel.service.ts` | EDIT — withdraw delegates; expose render snapshot for backup |
| `modules/omnichannel/controllers/omnichannel-admin.controller.ts` | EDIT — routes §3 + PR-6 decorators |
| `modules/omnichannel/services/outbox-worker.service.ts` | EDIT — narrow: WITHDRAWN + delivery_messages on DELETE success |
| `modules/omnichannel/omnichannel-phase-acceptance.spec.ts` | EDIT |
| `modules/omnichannel/publication-automation.spec.ts` | EDIT only if `foldLiveRemoteMessages` interaction changes |
| `scripts/unit-specs.txt` | EDIT |
| `apps/web/src/components/admin/AdminOmnichannel.tsx` | EDIT optional — delete-plan UI |
| `docs/WORKLOG.md`, `docs/reports/2026-10-xx-omnichannel-pr7-delete-edit-backup.md` | EDIT/NEW |

**Do not touch:** `apps/web/src/lib/blog.ts` (TASK-20260831-003); `omnichannel-token-vault*`; Worker domain / `TELEGRAM_API_URL` (PR-12); SMS / `.tmp-sms-panel/**`; coverage matrix (PR-8); composer (PR-9); channel settings UI (PR-10); alerts (PR-13); god-service split (PR-15); outbox row DELETE; `docker-compose.yml` unless IPC unrelated; enabling live connectors except owner canary smoke.

## 8. Tests required

**Unit** (register in `scripts/unit-specs.txt`):

1. Parse comma-separated message IDs; reject partial album delete (default).
2. Bale 48h: `sentAt` older than 48h → plan includes `delete_window_expired` warning; delete attempt surfaces error on that id.
3. Backup row created before enqueue (mock `EntityManager` / repository).
4. confirmSku mismatch → 400.
5. Revert picks correct backup by id / “latest pre_edit”.
6. RBAC matrix hooks on new routes (strings in phase acceptance).

**Integration** (Postgres optional):

7. Migration up/down; FK integrity delivery → backup.
8. WITHDRAWN delivery excluded from `foldLiveRemoteMessages` / liveRemoteMessages (extend or new spec in `publication-automation.spec.ts`).

**Owner smoke (manual, not CI):**

9. Backup path on Iran listed in report.
10. One delete on Bale canary **4858359991** → message gone, backup row present, audit with `goRef`, delivery WITHDRAWN or messages marked deleted.

Pass bar: existing omnichannel unit specs green + `tsc` clean.

## 9. Must-do vs owner-gated

| Must-do (implementer, after PR-6) | Owner-gated |
| --- | --- |
| Migrations + entities + backup on delete/edit | Written **GO** before merge/deploy |
| Delete/edit/revert APIs + server RBAC | **DB backup** on Iran before migration (`scripts/backup-postgres.sh`) |
| Unify `withdraw` with backup pipeline | One **live** Bale canary delete smoke (4858359991) |
| Worker marks WITHDRAWN / delivery_messages | Enable connectors only for canary window if currently off |
| Unit specs + phase acceptance | Confirm D-9: Publisher may edit but not delete live posts |
| WORKLOG + session report with backup file path | Partial album delete policy (D-5) if business rejects default |
| | SKU confirm required for FREE_POST withdraw/delete (D-6) |

## 10. Rollback

- Revert PR commit; new tables remain empty or orphaned — safe.
- If migration applied with rows: **do not** run down on production without owner; backups are the human rollback for content.
- Feature: `OMNICHANNEL_DELETE_EDIT_ENABLED=false` (default **true** in dev, **false** in `.env.example` until owner smoke) — optional guard to disable POST delete/edit while keeping read-only delete-plan; implementer may use if deploy risk high.

Emergency: disable connectors; withdraw stops remote calls (existing behavior).

## 11. Non-goals

PR-0 / PR-12 **egress**, token vault, `TELEGRAM_MEDIA_UPLOAD_MODE`; PR-14 **bots** / inbox / PFI; PR-8 **coverage matrix** UI and out-of-panel reconcile ingest; PR-9 **composer**; PR-10 **channel_settings** / template activation UX; PR-11 media scan; PR-13 alerts; PR-15 god-service refactor; **`TARANOM_DEPLOY_FORCE` / `SKIP_DRAIN`**; mass requeue; retrying historical DEAD; live deletes outside Bale canary; outbox DELETE; changing idempotency/HOLD/cap logic (PR-3–5); blog author channel slice (separate task).

## 12. Open decisions (safe defaults)

| # | Question | Recommended default |
| --- | --- | --- |
| D-1 | WITHDRAWN on delivery vs only publication | **Both:** publication withdraw → WITHDRAWN; per-message delete all IDs → delivery WITHDRAWN |
| D-2 | `delivery_message` in PR-7 vs defer | **Ship minimal table** + lazy split from CSV; PR-8 matrix reads same helper |
| D-3 | Publisher delete? (D9) | **No** — delete/withdraw live remote = Owner + `goRef`; Publisher may edit/revert with audit |
| D-4 | Inline sync delete vs queue only | **Queue only** (existing outbox worker); delete-plan may call adapter only in explicit `dryRun: true` mock mode — never live in CI |
| D-5 | Partial album delete | **Disallow** — must delete full ID set in one request |
| D-6 | SKU confirm for FREE_POST | **Reason + typed confirm token** `FREE_POST` instead of SKU |
| D-7 | Backup retention (D16) | **No auto-purge** in PR-7; document 730-day future default |
| D-8 | Edit media change | **Caption/text only** in PR-7; media replace → PR-11 / composer |
| D-9 | `OMNICHANNEL_DELETE_EDIT_ENABLED` | Add flag default **false** in example env until owner canary pass |
| D-10 | Withdraw without connectors on | Local WITHDRAWN + backup from DB render only; `remoteDeletes: 0` in audit |

## 13. Sequence

1. Rebase on master with **PR-6** merged (RBAC + GO-ref on withdraw).
2. Owner: Postgres backup on Iran; record path.
3. Additive migration + entities.
4. Implement delete service + controller routes; wire withdraw.
5. Implement edit/revert service.
6. Narrow worker completion hooks.
7. Unit specs → optional integration.
8. Optional Admin UI slice.
9. Report + WORKLOG; **wait for GO** → deploy Iran; owner runs canary delete on Bale **4858359991** once; flip `OMNICHANNEL_DELETE_EDIT_ENABLED` if used.
