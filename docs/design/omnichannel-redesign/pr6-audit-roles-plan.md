# PR-6 Audit + roles — file plan (plan only, no code)

Source: `stage2-design.md` §3.9 · §4 (نقش‌ها و GO) · §6 row PR-6 · `pr-execution-queue.md` row 6 · `stage1-requirements.md` REQ-O1/O2 · migration **`20260829-001-omnichannel-audit`** (TASK program ref: omnichannel Phase 7 audit table — not Torob).
Gate: CODE only · **depends on PR-5 (#126) merged** (cap/quiet at claim stable). No merge/deploy without Hamed's written GO.

## 0. Headline finding

**Audit infrastructure is partially shipped; RBAC is not.** Table `omnichannel_audits` exists (migration `20260829-001-omnichannel-audit.ts`, entity `OmnichannelAuditEntity`) and many mutating service paths call private `audit()`. Admin access is **binary**: JWT + `@Roles('ADMIN')` + `OmnichannelAdminGuard` (reload active `users.role === 'ADMIN'`). There is **no** Viewer / Publisher / Owner split, **no** mandatory `goRef` on Owner-tier mutations, **no** DB append-only enforcement, and **no** `source` / structured before-after / deploy rows in the panel audit stream. PR-6 is a **delta PR**: harden audit schema + append-only, enforce server-side omnichannel roles with a safe default flag, wire GO-ref for Owner actions, and close the **`requeueByCategory` Owner gate** called out as out-of-scope in the PR-4 (HOLD / no auto-revive) report — without touching egress, vault, SMS, or bots.

## 1. Invariants (must hold after PR-6)

- **Shared monolith:** Product, Order, Inventory, PostgreSQL, outbox/worker unchanged in trust model; connectors stay off unless owner enables elsewhere.
- **Audit is append-only:** no UPDATE/DELETE on audit rows from application code; DB rejects mutation if practical (trigger or revoked privileges on role used by API).
- **Secrets:** audit `payload` / `reason` never contain provider tokens; existing `assertNoPlaintextSecrets` rules apply to GO-ref and reasons.
- **Authorization on server:** role checks in guards/services — UI hiding alone is insufficient.
- **GO-ref:** Owner-tier actions require non-empty `goRef` (written GO from Hamed); stored on the audit row and queryable.
- **Viewer:** any HTTP mutating omnichannel admin route → **403** (except auth/session endpoints outside this controller).
- **Publisher:** may dry-run, preview, single live `createPublication`, template CRUD that does not activate LIVE policy (see matrix); may not bulk/requeue, secrets, global/destination publish policy, HOLD/reapprove, outbox clear/revive, withdraw, or Owner-tier settings.
- **Owner:** full mutating set per matrix; Owner-tier requires `goRef` where stage2 marks «+ GO-ref».
- **Staff `users.role`:** remains ADMIN (or future staff roles with `omnichannel` module); **omnichannel role is a separate dimension** — do not demote staff to CUSTOMER.
- **Rollback:** `OMNICHANNEL_RBAC_ENABLED=false` restores pre-PR-6 behavior (any active ADMIN = full access) for emergency revert without data loss.
- **Deploy GO:** existing `deploy-approval.json` + `scripts/lib/deploy-gate.*` stay authoritative for production deploy; PR-6 **mirrors** deploy events into audit/read API where cheap — does not replace deploy gate.

## 2. Existing audit (`20260829-001`) vs stage2 gaps

### 2.1 What exists

| Piece | Location | Behavior today |
| --- | --- | --- |
| Table | `20260829-001-omnichannel-audit.ts` | `omnichannel_audits`: `id`, `actorId`, `action`, `entityType`, `entityId`, `channel`, `reason`, `payload` jsonb, `createdAt`; index on `(entityType, entityId)` |
| Entity | `omnichannel-audit.entity.ts` | TypeORM entity; no `@DeleteDateColumn`; no immutability hook |
| Writer | `omnichannel.service.ts` → `audit()` | Insert-only in app code for ~20 action types (secrets, settings, destination publish patch, outbox clear/revive, requeue-by-category, withdraw, delivery retry/reapprove, reconcile, connection/destination ops, etc.) |
| Reader | `listAudits()` | Last 100 rows; **payload omitted** from SELECT; optional filter by `destinationId` via payload JSON |
| Admin API | `GET /v1/omnichannel/audits` | Same as list; any ADMIN |
| Guard | `omnichannel-admin.guard.ts` | DB reload; `req.omnichannelActor = { id, role: users.role }` — always `ADMIN` if guard passes |
| Controller | `omnichannel-admin.controller.ts` | Class-level ADMIN + guard; **no per-route role** |
| Deploy log | PR-0 `logs/deploy.log`, `deploy-gate` | commit + goRef on deploy; **not** linked to `omnichannel_audits` |
| Phase doc | `docs/reports/2026-08-29-omnichannel-phases-4-8.md` | Documented audit actor/reason; payload stripped on GET |

### 2.2 Gaps vs stage2 / REQ-O1/O2

| Stage2 / REQ | Gap |
| --- | --- |
| `audit_event` append-only, before/after, GO-ref, **source** (panel / out_of_panel) | Table named `omnichannel_audits`; no `goRef`, `source`, or structured diff columns; no out-of-panel ingest |
| Viewer cannot write | Any ADMIN can POST everything |
| Publisher vs Owner matrix (§4) | Not implemented |
| requeue-by-category / bulk **Owner + GO-ref** | `requeueByCategory` only requires `reason` + `confirm`; **any ADMIN**; UI exposes «شروع ارسال دسته» (`AdminOmnichannel.tsx`) |
| HOLD / `reapprove` Owner-only | `reapproveDelivery` open to any ADMIN |
| Destination/connection publish settings, secrets, cap/quiet/mode | Patched by any ADMIN; only some paths audit |
| CRUD without audit | `createConnection`, `createDestination`, `patchConnection`, `patchDestination`, `createTemplate`, `patchTemplate`, `patchMediaAlt` — **no** `audit()` |
| `retryDelivery` | Publisher-level in design; currently ADMIN-wide |
| CSV export without PII | No dedicated export endpoint; list lacks payload |
| Deploy history in panel | Only filesystem log |
| Append-only enforcement | ORM could delete/update; no DB trigger |

### 2.3 Admin guard vs omnichannel roles

| Layer | Today | After PR-6 |
| --- | --- | --- |
| `RolesGuard` | `ADMIN` JWT claim | unchanged |
| `OmnichannelAdminGuard` | Active DB `ADMIN` | extend to attach **`omnichannelRole`** (`VIEWER` \| `PUBLISHER` \| `OWNER`) |
| Route decorators | none | `@OmnichannelMinRole('PUBLISHER')`, `@RequiresGoRef()` on Owner-tier POST/PATCH/DELETE |
| Staff module ACL | `staff-access.ts` — only `ADMIN` has `omnichannel` module | unchanged; omnichannel role is **sub-ACL** inside module |

## 3. Action matrix (implementer source of truth)

Aligned with `stage2-design.md` §4. «GO» = body field `goRef` validated when `OMNICHANNEL_RBAC_ENABLED=true`.

| Action (route / service) | Min role | GO-ref |
| --- | --- | --- |
| GET health, status, settings, lists, audits, preview (dry) | VIEWER | — |
| POST preview, POST publications `dryRun=true` | PUBLISHER | — |
| POST publications live (single) | PUBLISHER | — |
| POST templates CRUD, PATCH media alt | PUBLISHER | — |
| POST connections/:id/test, discover-chats, destinations verify/test-post, canary-ping | PUBLISHER | — |
| PATCH templates / connection metadata (non-policy) | PUBLISHER | — |
| POST deliveries/:id/retry | PUBLISHER | — |
| POST publications/:id/withdraw, bulk-withdraw | OWNER | yes |
| POST publications/requeue-by-category **live** | OWNER | yes |
| POST deliveries/:id/reapprove | OWNER | — (HOLD confirm; optional goRef D-3) |
| PATCH settings, destination/connection publish-settings, PUT/DELETE secrets | OWNER | yes |
| DELETE connections/destinations | OWNER | yes |
| POST outbox/clear-waiting, outbox/revive-connector-disabled | OWNER | yes |
| POST reconcile | OWNER | yes |
| createConnection / createDestination (bootstrap) | OWNER | yes (D-4) |

Dry-run requeue (`dryRun: true`) → **PUBLISHER** allowed (planning), no GO-ref.

## 4. Acceptance criteria (testable)

1. With `OMNICHANNEL_RBAC_ENABLED=true` and actor omnichannelRole `VIEWER`, `POST /v1/omnichannel/publications` → **403**; `GET /v1/omnichannel/audits` → **200**.
2. Publisher can `POST /publications` with `dryRun=false` on a canary/fixture destination (mocked adapter) → **201/200** + audit row `action` publish path with `source: panel`.
3. Publisher calling `POST /publications/requeue-by-category` with `dryRun=false` → **403**; Owner with valid `goRef` → **200** + audit includes `goRef` and batch stats.
4. Owner-tier call without `goRef` when RBAC enabled → **400** with Persian message (not 403) — distinguishes missing GO from role denial.
5. `listAudits` returns `goRef`, `source`, redacted `payload` summary (no token-shaped strings); still no raw secrets.
6. Migration/trigger: direct SQL `UPDATE omnichannel_audits` / `DELETE` as app role → **failure** (integration spec on disposable DB).
7. `createConnection` (Owner + goRef) writes audit row; regression: existing audited actions still write rows.
8. `OMNICHANNEL_RBAC_ENABLED=false`: any ADMIN retains full mutating access (flag rollback).
9. Phase acceptance spec extended for guard decorators on requeue, reapprove, secrets, clear-waiting.

## 5. Files to claim (implementer)

Register in `.ai-dos/tasks/active.yaml`: owner, branch `feat/omnichannel-pr6-audit-roles`, worktree, file list below. **Start after PR-5 (#126) on master.**

| File | Action |
| --- | --- |
| `modules/omnichannel/entities/omnichannel-audit.entity.ts` | EDIT — optional columns `goRef`, `source`; document payload diff convention |
| `database/migrations/20260829-001-omnichannel-audit.ts` | **Do not edit** shipped migration; add **new** additive migration e.g. `20261028-001-omnichannel-audit-rbac.ts` |
| `database/migrations/*-omnichannel-audit-rbac.spec.ts` | NEW — up/down + append-only trigger/SQL asserts |
| `modules/omnichannel/guards/omnichannel-admin.guard.ts` | EDIT — resolve `omnichannelRole` onto `req.omnichannelActor` |
| `modules/omnichannel/guards/omnichannel-role.guard.ts` | NEW — min role + GO-ref metadata |
| `modules/omnichannel/decorators/omnichannel-role.decorator.ts` | NEW |
| `modules/omnichannel/omnichannel-rbac.ts` | NEW — pure matrix + `resolveOmnichannelRole(userId)` |
| `modules/omnichannel/omnichannel.constants.ts` | EDIT — `OMNICHANNEL_RBAC_ENABLED`, owner allowlist env |
| `modules/omnichannel/dto/omnichannel.dto.ts` | EDIT — `goRef` on Owner DTOs (`RequeueByCategoryDto` live, `PatchOmnichannelSettingsDto`, `ClearWaitingOutboxDto`, etc.) |
| `modules/omnichannel/controllers/omnichannel-admin.controller.ts` | EDIT — per-route guards/decorators |
| `modules/omnichannel/services/omnichannel.service.ts` | EDIT — `audit()` signature (`goRef`, `source`, before/after); validate GO; audit missing CRUD; **requeueByCategory** Owner gate |
| `modules/omnichannel/guards/omnichannel-admin.guard.spec.ts` | EDIT |
| `modules/omnichannel/omnichannel-rbac.spec.ts` | NEW — matrix unit tests |
| `modules/omnichannel/omnichannel-phase-acceptance.spec.ts` | EDIT — route guard strings |
| `scripts/unit-specs.txt` | EDIT — register new specs |
| `docs/WORKLOG.md`, `docs/reports/2026-10-xx-omnichannel-pr6-audit-roles.md` | EDIT/NEW — evidence |

**Optional (owner-gated scope):** minimal `AdminOmnichannel.tsx` — disable requeue live + Owner buttons when API returns 403; **API enforcement is mandatory**, UI is UX-only.

**Do not touch:** `outbox-worker.service.ts`, adapters, `omnichannel-token-vault*`, `scripts/auto-deploy.sh` (except optional one-line audit ingest if owner wants — default **no**), `.tmp-sms-panel/**`, SMS modules, connector flags, `docker-compose.yml`, delete/edit message APIs (PR-7), coverage/composer (PR-8/9), channel settings UI redesign (PR-10).

## 6. Migration needs

| Item | PR-6 |
| --- | --- |
| `20260829-001` baseline | Already on production path; **keep** |
| Additive columns | `goRef varchar NULL`, `source varchar NOT NULL DEFAULT 'panel'` on `omnichannel_audits` |
| Role storage | **Preferred:** `users.omnichannelRole varchar NULL` (nullable → resolve via defaults). **Alternative:** JSON map in `app_settings` key `omnichannel_role_map` — avoid if single-column is acceptable |
| Append-only | `CREATE OR REPLACE FUNCTION …` trigger `BEFORE UPDATE OR DELETE` → `RAISE EXCEPTION`; or revoke UPDATE/DELETE on table for app DB user (document in migration spec) |
| Indexes | Optional `IDX_omnichannel_audits_createdAt` DESC for list; optional `(action, createdAt)` if search added |
| `deploy_log` table | **Out of scope** — use existing `logs/deploy.log` + future PR if panel deploy tab needs DB |
| Backup gate | Standard GO; **no backup required** for additive nullable columns + trigger only |

## 7. Open decisions (safe defaults)

| # | Question | Recommended default |
| --- | --- | --- |
| D-1 | Where store Viewer/Publisher/Owner? | Column `users.omnichannelRole`; null → treat as **OWNER** when RBAC flag off; when flag on, null → **PUBLISHER** except IDs in `OMNICHANNEL_OWNER_USER_IDS` → OWNER |
| D-2 | Who is Owner? | Env allowlist UUIDs (Hamed's admin user ids); only allowlist may assign OWNER to others (future UI → PR-10) |
| D-3 | `reapprove` GO-ref? | **No** goRef (reason only); stage2 lists Owner without «+ GO-ref» |
| D-4 | Bootstrap createConnection/Destination | Require Owner + goRef when RBAC on; else existing open ADMIN |
| D-5 | Feature flag | `OMNICHANNEL_RBAC_ENABLED` default **false** in `.env.example`; production enable only after owner maps roles |
| D-6 | Table name `audit_event` vs `omnichannel_audits` | **Keep** `omnichannel_audits` (live data); alias in docs only |
| D-7 | Audit payload on GET | Return **redacted** subset (`goRef`, counts, ids) — never full connection settings or tokens |
| D-8 | Out-of-panel ingest | **Defer** manual CSV/script to PR-8 coverage; add `source='out_of_panel'` column now for future rows |
| D-9 | Publisher withdraw/delete | Stage2: delete Owner-only; withdraw treated as **Owner + goRef** (remote delete side effect) |

## 8. Tests required

Unit (register in `scripts/unit-specs.txt`):

1. `omnichannel-rbac.spec.ts` — matrix: each route class → min role; GO-ref required set.
2. `omnichannel-admin.guard.spec.ts` — role resolution from user row + allowlist.
3. `audit()` — rejects token-like `goRef`/`reason`; persists `source`, `goRef`.
4. `RequeueByCategoryDto` validation — live requires `confirm` + `goRef` when RBAC on.

Integration (Postgres disposable, skip without DB):

5. Trigger blocks UPDATE/DELETE on `omnichannel_audits`.
6. Optional: insert audit as Viewer via service forbidden paths (controller e2e mock).

Pass bar: existing omnichannel unit specs green + `tsc` clean.

## 9. Must-do vs owner-gated

| Must-do (implementer, after PR-5 merge) | Owner-gated |
| --- | --- |
| Append-only audit migration + extended writer | Written **GO** before merge/deploy |
| `OMNICHANNEL_RBAC_ENABLED` + server enforcement | Confirm D-1/D-2: owner user id allowlist on Iran |
| GO-ref on Owner-tier API (incl. **requeueByCategory live**) | Enable RBAC flag on production |
| Close **requeueByCategory Owner gate** (PR-4 report leftover) | Map Publisher staff accounts |
| Audit for previously silent CRUD | Optional Admin UI button disable |
| WORKLOG + session report | Out-of-panel historical Bale rows (manual ingest) |
| | Deploy audit ingest from `auto-deploy.sh` |

## 10. Rollback

Set `OMNICHANNEL_RBAC_ENABLED=false` or revert PR. Audit columns/trigger remain harmless; new rows may include null `goRef`. Revert trigger migration only if down() tested on disposable DB — **not** required for emergency flag-off.

## 11. Non-goals

Telegram **egress** / Worker custom domain / `TELEGRAM_API_URL` (**PR-12**); **token vault** / `OMNICHANNEL_VAULT_KEY` move; **SMS** and `.tmp-sms-panel/**`; **PR-14** bots/inbound/PFI; delete/edit message endpoints and WITHDRAWN semantics (**PR-7**); coverage matrix UI (**PR-8**); composer wizard (**PR-9**); full channel settings / template activation UX (**PR-10**); alerts (**PR-13**); god-service split (**PR-15**); enabling connectors; live canary validation; outbox row DELETE; changing cap/quiet claim logic (**PR-5**); mass requeue **behavior** (cap/gap) — only **authorization + audit** for requeue.

## 12. PR-4 leftover: `requeueByCategory` Owner gate

PR-4 (no auto-revive / HOLD on unknown) intentionally scoped **authorization** out. The session report / handoff expectation: **`POST /publications/requeue-by-category`** remains callable by any ADMIN with `reason` only — contradicting `stage2-design.md` §3.2/§4 and REQ-P4 (Owner + GO-ref, SKU preview before live). PR-6 **must**:

- Enforce **OWNER** + non-empty **`goRef`** on live requeue (not dry-run).
- Persist both on audit action `publications_requeue_by_category`.
- Leave enqueue/cap/gap logic unchanged (already respects `dailyRoom` per PR-5 era code).

UI may still show dry-run to Publisher; live button requires Owner + GO dialog (follow-up if not in PR-6 API-only slice).

## 13. Sequence

1. Rebase on master with PR-5 (#126) merged.
2. Additive migration + entity + append-only enforcement.
3. Pure RBAC matrix + guards; wire controller routes.
4. Extend `audit()` + backfill missing CRUD audits; GO-ref validation.
5. Unit specs → optional integration.
6. Report + WORKLOG; **wait for GO** → deploy Iran only per runbook; owner sets allowlist then flips `OMNICHANNEL_RBAC_ENABLED`.
