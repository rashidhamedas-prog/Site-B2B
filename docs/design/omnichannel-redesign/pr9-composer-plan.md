# PR-9 Composer — file plan (plan only, no code)

Source: `stage2-design.md` §1 (IA tab ۴) · §3.4 · §4 (Publisher single live بدون GO) · §6 row PR-9 · `stage1-requirements.md` · `req-technical.md` §8 · `pr-execution-queue.md` row 9 · GO package **continue-119-to-end** (2026-10-28): `00-CURSOR-MASTER-PROMPT.md` · `.ai-dos/tasks/handoff.md` — skip **PR-12** (egress/vault/Worker domain/`TELEGRAM_API_URL`); **PR-14 bots/inbox last** after PR-8–11, PR-13, PR-15; no `TARANOM_DEPLOY_FORCE` / `SKIP_DRAIN`; live ops smoke **Bale canary chat `4858359991` only**; **Postgres backup on Iran before every migration** (record path e.g. `/opt/taranom/backups/postgres/YYYYMMDDTHHMMSSZ`).

Gate: **CODE** · **depends on PR-8 merged (soft)** — coverage deep-link and duplicate context; **hard minimum PR-7 + PR-6** (live fold + RBAC). **Soft prep** allowed in parallel: pure `composer-plan.ts` + UI skeleton behind flag without changing worker/adapters.

## 0. Headline finding

**Publish logic exists; the operator journey does not match stage2 Composer.** `POST /v1/omnichannel/publications` + `createPublication()` already dry-run by default (`dryRun !== false`), plan CREATE/UPDATE via `planManualDeliveries`, enqueue through outbox only on live, and respect cap/quiet at claim (PR-5). Gaps: (1) **monolithic** `AdminOmnichannel.tsx` mixes bot setup, requeue, manual preview — not the 7-step wizard (§3.4); (2) **dry-run skips dedupe truth** — `liveRemote` is `[]` when `dryRun`, so operators cannot see «قبلاً در بله … ← ویرایش؟» without a live attempt; (3) **single optional `destinationId`** — no explicit multi-destination picker with **zero defaults ticked**; (4) **no first-class schedule** in DTO — only implicit slot from cap/gap on enqueue; (5) **no in-page Publisher confirm** dialog separate from browser `confirm`; (6) **bulk/category publish** still exposed as raw requeue block, not Owner+GO composer step. PR-9 is a **product delta**: wizard UI + enriched dry-run/plan API + scheduling validation + deep-links from PR-8 — **without** channel_settings redesign (PR-10), media scan (PR-11), egress (PR-12), alerts (PR-13), bots (PR-14), or god-service split (PR-15).

## 1. Invariants (must hold after PR-9)

- **Shared monolith:** Product, Order, Inventory, stock fields unchanged; no connector enable in CI; no new `OMNICHANNEL_*` send flags beyond UI feature flag documented in `.env.example`.
- **Dry-run = zero provider I/O:** `dryRun: true` must not call adapters, Worker Bot API, or `fetch` to messenger hosts; may read DB for projection, live fold, cap/quiet simulation.
- **Live path unchanged in trust model:** live enqueue still only via `publication.deliver.requested` / existing outbox worker — no direct Bot API from HTTP handler.
- **RBAC (PR-6):** single live publish → **PUBLISHER+** without `goRef`; bulk/category live → **OWNER + `goRef`** (`publications_requeue_by_category_live`); Viewer → 403 on mutating composer routes.
- **No default destinations:** wizard step ② starts with **no** channel checkboxes selected; API rejects empty `destinationIds[]` on live send.
- **Retail vs wholesale:** product search and publish scope stay channel-scoped (`RETAIL` | `WHOLESALE`); no silent WHOLESALE default.
- **Dedupe (PR-3):** dry-run/plan surfaces CREATE vs UPDATE per destination from `liveRemoteMessages` + `pendingCreateDestinationsForSource`; does not bypass idempotency keys on live enqueue.
- **Quiet hours (stage2 §3.4):** user-selected «اکنون» that falls in configured quiet window → **400 with Persian message**, not silent defer (composer validates before confirm); «slot بعدی» uses existing `evaluateAutomationGate` / `resolveSlotForCreate` pure helpers for display.
- **FREE_POST:** same wizard branch without product step; Telegram article disabled in UI; gated by `OMNICHANNEL_FREE_POST_ENABLED` (existing).
- **Secrets:** plan/dry-run responses never include tokens; preview URLs scrubbed.
- **Canary / prod smoke:** at most **one** live CREATE/UPDATE on Bale destination tied to chat **`4858359991`**; no Telegram/Rubika live posts in automated acceptance.
- **Performance:** product search debounced, max **20** results; wizard code-split (`admin-omnichannel-composer.tsx` lazy); no loading 200 SKUs on mount.

## 2. Existing behavior vs stage2 gaps

### 2.1 What exists

| Piece | Location | Behavior today |
| --- | --- | --- |
| Create + dry-run | `omnichannel.service.ts` → `createPublication` | Default dry-run; single `destinationId` or all manual targets |
| Preview | `preview()` / `PreviewDto` | Catalog projection per channel |
| Delivery plan | `planManualDeliveries` | CREATE/UPDATE split from live + pending |
| Cap / quiet | PR-5 claim + `evaluateAutomationGate` | Enforced at send; not always shown pre-submit in UI |
| Category bulk | `requeueByCategory` | Owner+GO when RBAC on; separate UI section |
| Admin shell | `AdminOmnichannel.tsx` | Manual preview textarea, destination select, dry-run buttons |
| Coverage link | PR-8 `admin-omnichannel-coverage.tsx` | `?productId=` navigation; composer button until PR-9 |
| RBAC | `omnichannel-rbac.ts`, role guard | Publisher publish; bulk requeue needs goRef |

### 2.2 Gaps vs stage2 §3.4 / §4

| Requirement | Gap |
| --- | --- |
| 7-step wizard (product → destinations → caption → media → time → dry-run → confirm) | Single scrolling form |
| No default destination ticks | Often pre-selects first destination / implicit «all verified» |
| Per-channel caption + price toggle (default off) | Template from destination; limited per-channel override in manual path |
| Dry-run per channel + dedupe hint | `liveRemote = []` on dry-run |
| Schedule vs now + quiet error | No explicit schedule field; quiet only at claim |
| In-page Publisher confirm (reason) | `window.confirm` on bulk only |
| Bulk Owner + GO with SKU list preview | Requeue UI not wizard-integrated |
| FREE_POST flow in composer | Partially in monolith block |
| Flag revert to legacy form | Missing |

## 3. Target API (implementer contract)

Prefix: `/v1/omnichannel`. Extend rather than fork where possible.

| Method | Path | Role | Purpose |
| --- | --- | --- | --- |
| GET | `composer/products` | PUBLISHER+ | Query: `q`, `channel` (required), `limit`≤20. Returns `{ items: [{ id, sku, name, thumbnailUrl, available }] }`. |
| POST | `composer/plan` | PUBLISHER+ | Body: `{ preview: PreviewDto, destinationIds: uuid[], options?: { includePrice?: Record<destId, boolean>, captionOverrides?: Record<destId, string>, sendMode: 'next_slot' \| 'scheduled', scheduledAt?: ISO8601 } }`. **Always dry** — no outbox writes. Returns per-destination `{ destinationId, channel, provider, action: 'CREATE'\|'UPDATE'\|'SKIP', liveHint?, renderedPreview, capRemaining, quietConflict?, slotAtTehran? }` + summary counts. Loads `liveRemoteMessages` for dedupe. |
| POST | `publications` | PUBLISHER+ | **Extend** `CreatePublicationDto`: `destinationIds?: uuid[]` (min 1 on live), `sendMode`, `scheduledAt`, `captionOverrides`, `includePrice` map; deprecate implicit «all targets» on live unless Owner explicitly selects «همه مقصدهای مجاز» in UI (server: require non-empty `destinationIds` when `OMNICHANNEL_COMPOSER_STRICT_DESTINATIONS=true`, default true behind composer flag). |
| POST | `publications/requeue-by-category` | OWNER + `goRef` | Unchanged semantics; composer bulk step calls this with `dryRun` preview first. |

**Dry-run contract:** existing `createPublication` with `dryRun: true` should call shared **`buildComposerPlan()`** so DRAFT save behavior stays but response includes **`plan`** matching `POST composer/plan` (implementer: refactor to one pure function).

**Scheduling:** live enqueue passes computed `availableAt` into `enqueueDeliveries` when `sendMode='scheduled'` or deferred slot; **no new table** if `outbox_events.availableAt` + delivery row timestamps suffice (D-2). If product needs persisted «scheduled publication» row for cancel UI, optional additive migration — owner backup before apply.

## 4. Data model (migrations)

**Default: no migration (D-1).** Scheduling and plan state live in outbox `availableAt` + publication `READY`.

Optional (owner opt-in D-2): `omnichannel_scheduled_sends` — only if cancel/reschedule UX requires it in PR-9; otherwise defer to PR-10/11.

## 5. UI (admin)

New module: `admin-omnichannel-composer.tsx` (+ `admin-omnichannel-composer.spec.ts`).

- Nav tab **«انتشار جدید»** (stage2 §1 item 4); mount from `AdminOmnichannel.tsx` when `OMNICHANNEL_COMPOSER_UI=true` (default **false** in `.env.example`).
- **Steps ①–⑦** with stepper; RTL; Tehran labels on times.
- ① Product search (channel required) or «پست آزاد» toggle; read `productId` / `channel` from query string (PR-8 deep-link).
- ② Destinations: checklist Telegram / Rubika / Bale mapped from verified destinations; **none checked by default**.
- ③ Caption: per selected destination tabs; template render + manual override; **price toggle default off** per channel (uses projection fields — full policy UI remains PR-10).
- ④ Media: show validation status from product projection (placeholder until PR-11 scan — display existing image URL + size if known, warn if missing).
- ⑤ Time: radio «slot بعدی» vs datetime picker; show cap «۳ از ۱۰» from plan API; block with error if quiet conflict on «اکنون».
- ⑥ Dry-run: call `composer/plan` + `createPublication` dryRun; render per-channel cards; duplicate → amber «ویرایش» CTA linking to PR-7 edit or matrix.
- ⑦ Confirm: modal with summary + **reason** (required on live); Publisher can submit without GO; show role hint.
- **Bulk sub-mode (Owner):** switch «انتشار گروهی» → category picker + SKU count preview + **goRef** field + confirm; calls requeue endpoints only.
- Legacy: when flag false, existing monolith publish block unchanged.

**Do not edit:** `apps/web/src/lib/blog.ts` (TASK-20260831-003).

## 6. Files to claim (implementer)

Register in `.ai-dos/tasks/active.yaml`: owner, branch `feat/omnichannel-pr9-composer`, worktree.

| File | Action |
| --- | --- |
| `modules/omnichannel/composer-plan.ts` | NEW — pure: plan from targets + liveRemote + pending + cap/quiet simulation |
| `modules/omnichannel/composer-plan.spec.ts` | NEW — dedupe, quiet reject, multi-dest |
| `modules/omnichannel/services/omnichannel-composer.service.ts` | NEW — product search, plan orchestration |
| `modules/omnichannel/services/omnichannel-composer.service.spec.ts` | NEW |
| `modules/omnichannel/services/omnichannel.service.ts` | EDIT — unify dry-run plan; extend `createPublication` DTO handling; scheduled `availableAt` |
| `modules/omnichannel/dto/omnichannel.dto.ts` | EDIT — `CreatePublicationDto` extensions; `ComposerPlanDto` |
| `modules/omnichannel/controllers/omnichannel-admin.controller.ts` | EDIT — `composer/*` routes |
| `modules/omnichannel/omnichannel.module.ts` | EDIT — register composer service |
| `modules/omnichannel/omnichannel-rbac.ts` | EDIT — route classes if new actions |
| `database/migrations/*-omnichannel-scheduled-send.ts` | NEW — **only if D-2 chosen** |
| `apps/web/src/components/admin/admin-omnichannel-composer.tsx` | NEW |
| `apps/web/src/components/admin/admin-omnichannel-composer.spec.ts` | NEW |
| `apps/web/src/components/admin/AdminOmnichannel.tsx` | EDIT — tab + flag; trim duplicate publish UX when flag on |
| `apps/web/src/components/admin/admin-omnichannel-coverage.tsx` | EDIT — enable «انتشار جدا» link to composer query |
| `.env.example` | EDIT — `OMNICHANNEL_COMPOSER_UI`, optional `OMNICHANNEL_COMPOSER_STRICT_DESTINATIONS` |
| `scripts/unit-specs.txt` | EDIT |
| `docs/WORKLOG.md`, `docs/reports/2026-10-xx-omnichannel-pr9-composer.md` | EDIT/NEW |

**Do not touch:** `outbox-worker.service.ts`, `telegram.adapter.ts`, `bale.adapter.ts`, `rubika.adapter.ts`, `omnichannel-token-vault*`, Worker/`TELEGRAM_API_URL` (**PR-12**), SMS / `.tmp-sms-panel/**`, channel_settings UX (**PR-10**), media scan job (**PR-11**), coverage aggregation logic (**PR-8** — link only), alerts (**PR-13**), god-service split (**PR-15**), bots/webhook (**PR-14**), `docker-compose.yml`, `scripts/auto-deploy.sh`, connector enable flags, delete/edit backup implementation beyond linking (**PR-7**), outbox row DELETE.

## 7. Open decisions (safe defaults)

| # | Question | Recommended default |
| --- | --- | --- |
| D-1 | Migration for schedule | **None** — use outbox `availableAt` |
| D-2 | Persisted scheduled row | **Defer** unless cancel UX required in PR-9 |
| D-3 | Live «all verified destinations» | **Disabled** in composer; explicit checklist only |
| D-4 | Price in caption | Toggle per destination, **default false** (stage2 D4) |
| D-5 | Caption length UI | Telegram 4096 / Bale 1024 counters in step ③ |
| D-6 | BLOG_POST in composer v1 | **PRODUCT + FREE_POST only**; blog remains catalog automation |
| D-7 | `OMNICHANNEL_COMPOSER_UI` | Default **false** until API + wizard tested |
| D-8 | Dry-run DRAFT row | Keep existing DRAFT save on `createPublication` dryRun; add `plan` in JSON response |
| D-9 | Partial failure on multi-dest live | Same as today — per-delivery outbox rows; composer shows aggregate result after refresh queue |

## 8. Tests required

Unit (`scripts/unit-specs.txt`):

1. `composer-plan.spec.ts` — UPDATE when live exists; CREATE when not; pending CREATE → SKIP; quiet «now» → conflict flag.
2. `omnichannel-composer.service.spec.ts` — product search channel filter; plan with 0 destinations → 400.
3. `omnichannel-rbac.spec.ts` — `composer/plan` → PUBLISHER; bulk requeue from composer doc → OWNER+goRef.
4. Extend `createPublication` / free-post specs — dry-run returns non-empty `plan`; **mock assert zero adapter calls**.

Integration (Postgres disposable):

5. Seed product with SUCCEEDED Bale live → `composer/plan` shows UPDATE + `liveHint` without enqueue.
6. Live publish with two `destinationIds` → two delivery rows, correct actions.

Frontend:

7. `admin-omnichannel-composer.spec.ts` — no default checked destination; step gating; confirm requires reason.

**Acceptance (stage2 §6 / continue-119):**

- With connectors **off**, dry-run from wizard → network trace / adapter mocks show **zero** outbound messenger calls.
- With connectors **on** (owner, Iran), **one** live CREATE or UPDATE to Bale canary **`4858359991`** only; queue shows expected CREATE/UPDATE.
- PR-8 link `?productId=` pre-fills step ①.
- Revert: `OMNICHANNEL_COMPOSER_UI=false` restores legacy form.

Pass bar: omnichannel unit specs green + `tsc` clean.

## 9. Must-do vs owner-gated

| Must-do (implementer, after PR-8 on master) | Owner-gated |
| --- | --- |
| Pure `composer-plan` + `POST composer/plan` | Written **GO** before merge/deploy |
| Wizard UI behind flag | Enable `OMNICHANNEL_COMPOSER_UI` on Iran |
| Unify dry-run dedupe visibility | **DB backup** on Iran if optional schedule migration (D-2) |
| WORKLOG + session report | One Bale **4858359991** live smoke |
| Wire coverage deep-link | Confirm D-6 blog scope |
| Strict empty default destinations | Bulk category live only with **goRef** |
| | No `TARANOM_DEPLOY_FORCE` / `SKIP_DRAIN` |

## 10. Rollback

Set `OMNICHANNEL_COMPOSER_UI=false` (and `OMNICHANNEL_COMPOSER_STRICT_DESTINATIONS=false` if needed). Revert PR removes routes; legacy `createPublication` shape remains backward compatible if DTO fields optional. Optional migration table harmless if empty.

## 11. Non-goals

Telegram **egress** / Worker custom domain / `TELEGRAM_API_URL` / `TELEGRAM_MEDIA_UPLOAD_MODE` (**PR-12**); **token vault** / `OMNICHANNEL_VAULT_KEY`; **PR-14** bots/inbound/webhook/PFI/inbox; **PR-10** per-channel settings form, template activation Owner flow, «ضدآب» guard in template editor; **PR-11** media decode/scan/compress job; **PR-13** alerts; **PR-15** god-service refactor; **PR-8** coverage SQL/matrix (consume API/link only); **PR-7** delete/edit backup implementation (link only); SMS / `.tmp-sms-panel/**`; enabling connectors in CI; changing idempotency/HOLD/cap claim logic (**PR-3–5**); outbox row DELETE; mass requeue **behavior** changes beyond UI surfacing; **`TARANOM_DEPLOY_FORCE` / `SKIP_DRAIN`**; live sends outside Bale canary **`4858359991`**; blog author `channel=` slice (separate task); **`apps/web/src/lib/blog.ts`**.

## 12. Sequence

0. **Program order (continue-119):** PR-7 → PR-8 → **PR-9** → PR-10 → PR-11 → PR-13 → PR-15 → **PR-14 last**; **never** PR-12 egress/vault.
1. Rebase on master with **PR-8** merged (coverage link target exists).
2. Implement `composer-plan.ts` + tests (parallel_prep OK before PR-8 merge if no controller dependency).
3. Composer service + `composer/plan` route + extend `createPublication`.
4. Wizard UI + flag + coverage deep-link.
5. Unit/integration → report + WORKLOG → **wait for GO** → deploy Iran per runbook; backup before any migration.
