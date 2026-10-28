# PR-5 Cap / quiet / gap at claim — file plan (plan only, no code)

Source: `stage2-design.md` §5.2 (claim-time سقف/سکوت/gap) · §6 row PR-5 · `pr-execution-queue.md` row 5 · `stage1-requirements.md` (per-destination automation).
Gate: CODE only · **depends on PR-4 (#124) merged** (HOLD/lease/revive hardening stable before tightening send gates). No merge/deploy without Hamed's written GO.

## 0. Headline finding

**Daily cap, min-gap, and rate-limit are already enforced at worker claim** via `reserveCreateSend` → in-tx counts → `planCreateSend` → `DEFER_CREATE_SQL` or atomic `PROCESSING` claim. **Quiet hours are not enforced at claim** (only used for cap rollover jitter via `quietEndHour` inside `decideDailyCap`, and for **auto-scheduling** in `evaluateAutomationGate` / **free-post** only). PR-5 is therefore a **delta PR**: close the quiet-at-claim gap, align counter semantics with stage2 «per-destination / per-channel settings», add proof tests, and tighten operator slot hints — not a greenfield gate.

## 1. Invariants (must hold after PR-5)

- Settings source of truth: **per-destination** `publishSettings` resolved with `resolveDestinationPublishSettings` (connection/global fallbacks only where the resolver already allows). **No** new `OMNICHANNEL_DAILY_CAP_*` env overrides (matches `dailyCapForProvider`).
- All CREATE sends (auto, manual, requeue, retry) pass the **same** claim gate before `adapter.create`; UPDATE/DELETE unchanged.
- Cap counts **Tehran calendar day**, per **destinationId** (one sales channel per destination via its connection).
- Deferrals set `deferredReason` + `nextAttemptAt` on the delivery row; worker surfaces `DeliveryDeferredError` and reschedules outbox — **no adapter call**, no duplicate `PROCESSING` leak (existing `releaseProcessingDelivery` path).
- Quiet window: both `quietStartHour` and `quietEndHour` required (0–23 Tehran); partial window = disabled (existing `readAutomationSettings` rule).
- **No invented destination IDs** in code, fixtures, or docs; tests use generated UUIDs only.
- Stock, vault, egress, SMS, bots: untouched (shared monolith rules).

## 2. What already exists

| Piece | Location | Behavior today |
| --- | --- | --- |
| Pure send plan | `delivery-idempotency.ts` — `planCreateSend`, `decideDailyCap`, `decideMinGap`, `decideRateLimit`, `capJitterMs`, `dailyCapForProvider`, `effectiveMinGapSeconds` | Ordered: stale → cap (+ inFlight) → gap → rate → `send`. `quietEndHour` only shifts **next-day** cap deferral, not live quiet blocking. |
| Claim orchestration | `omnichannel.service.ts` — `reserveCreateSend` | Pre-read row; tx: advisory locks (`idempotencyKey`, `cap:{destinationId}:{day}`); `RESERVE_CREATE_LOCK_ROW_SQL`; sibling dedupe; `RESERVE_CREATE_COUNTS_SQL`; `planCreateSend`; defer / HOLD / supersede / `UPDATE … PROCESSING`. |
| Count SQL | `reserve-create-send-sql.ts` — `RESERVE_CREATE_COUNTS_SQL` | **sent**: SUCCEEDED CREATE today per destination; **inflight**: PROCESSING (10m fresh) + PENDING/RETRY/HOLD per destination; **last_sent**: MAX sentAt; **per_minute**: SUCCEEDED in last 60s **per connectionId** (all destinations on bot). |
| Worker hook | `outbox-worker.service.ts` | CREATE → `reserveCreateSend`; `defer` → `DeliveryDeferredError`; `stop` → return without adapter. |
| Enqueue-time automation | `publication-automation.ts` — `evaluateAutomationGate` | Cap, gap, **quiet** (`inQuietHours` / `nextQuietEnd`) when **scheduling** auto CREATE `availableAt`. |
| Enqueue-time manual / API | `omnichannel.service.ts` — `resolvePublishScopeForTargets`, `nextCreateAvailableAt`, manual publish | Cap/gap at enqueue for operators; **`nextCreateAvailableAt` omits quiet**; catalog manual publish **explicitly skips** live quiet (comment ~L1727); free-post has `assertFreePostNotInLiveQuietHours`. |
| Diagnosis / health | `gate-block-reason.ts`, `omnichannel-health.ts`, `diagnoseGateBlock` | Operator-facing cap/quiet block reasons; health shows cap/quiet from resolved settings (read-only). |
| Defaults | `omnichannel.constants.ts` | `DEFAULT_AUTO_DAILY_CAP=20`, `DEFAULT_AUTO_MIN_GAP_SECONDS=90`, gap floor `MIN_SEND_GAP_FLOOR_SECONDS=60`, `DEFAULT_MAX_SENDS_PER_MINUTE` (+ optional `OMNICHANNEL_MAX_SENDS_PER_MINUTE`). |
| Deferred reason catalog | `DELIVERY_DEFERRED_REASONS` | `daily_cap`, `min_gap`, `rate_limit`, … — **no `quiet_hours`**. |

## 3. Gaps vs stage2 (claim-time, per channel/destination)

| Stage2 expectation | Gap |
| --- | --- |
| سقف/سکوت/gap **هنگام claim** بررسی شود (§5.2) | Cap + gap + rate **yes** at claim; **quiet no** at claim. |
| Per-destination channel settings (§5.1, D1/D15) | Settings resolution **yes**; minor risk: `countCreatesTowardDailyCap` joins `publication.channel` while claim SQL does not (destination should imply channel — **add test**). |
| Health «slot بعدی» / queue UX (§3.1) | `nextCreateAvailableAt` and defer paths should include **quiet end** like `evaluateAutomationGate`. |
| Composer quiet conflict (§3.4) | Enforced only indirectly; **claim** must be authoritative so stale queue rows cannot send in 23–08 window. |
| `attempt_started` / `lease_until` on claim row (§5.2) | **Not in repo** — scoped to **PR-4** (#124). PR-5 must not depend on new columns; if PR-4 adds them, PR-5 rebases and only documents interaction (claim still before adapter). |

Additional hardening (in scope if cheap):

- **`inFlight` includes HOLD** toward cap at claim — can starve cap when many HOLD rows exist; confirm intentional (conservative) or exclude HOLD from cap weight (decision D-2).
- **Rate limit per connection**, not per destination — likely correct for provider API; document as intentional (D-3).
- **Mode OFF** does not block claim today — queued deliveries may still send; optional defer/stop at claim when `automation.mode === 'OFF'` (D-4, default **defer** with clear reason vs silent send).

## 4. Acceptance criteria (testable)

1. With destination quiet window 23→08 Tehran, a PENDING CREATE whose outbox fires at 23:30 **defers** at claim with `deferredReason=quiet_hours` (new) and `nextAttemptAt` ≥ next quiet end (same semantics as `nextQuietEnd`).
2. Outside quiet window, cap/gap/rate behavior unchanged (existing `delivery-idempotency.spec.ts` cases stay green).
3. Two destinations on same connection with **different** quiet settings defer independently at claim (per-destination settings).
4. Manual/auto queued items scheduled for daytime but processed during quiet (clock skew / delay) still **defer at claim**, zero adapter calls (worker mock count).
5. `nextCreateAvailableAt(destinationId)` returns time ≥ quiet end when now inside window (operator slot hints align with claim).
6. `RESERVE_CREATE_COUNTS_SQL` sent/inflight counts match `countCreatesTowardDailyCap` for the same destination+day (integration or shared fixture).
7. Regression: concurrent `reserveCreateSend` + defer does not leave row stuck in PROCESSING (existing worker spec assertions).

## 5. Files to claim (implementer)

Register in `.ai-dos/tasks/active.yaml`: owner, branch `feat/omnichannel-pr5-cap-quiet`, worktree, file list below. **Start after PR-4 (#124) on master.**

| File | Action |
| --- | --- |
| `modules/omnichannel/delivery-idempotency.ts` | EDIT — extend `planCreateSend` (or adjacent pure fn) with quiet check using `inQuietHours` / `nextQuietEnd`; extend `SendPlan` defer reason |
| `modules/omnichannel/omnichannel.constants.ts` | EDIT — add `quiet_hours` to `DELIVERY_DEFERRED_REASONS` if stored on row |
| `modules/omnichannel/services/omnichannel.service.ts` | EDIT — pass `quietStartHour`/`quietEndHour` into plan; wire `nextCreateAvailableAt`; optional mode gate (D-4) |
| `modules/omnichannel/services/reserve-create-send-sql.ts` | EDIT only if inflight/cap SQL changes (D-2) |
| `modules/omnichannel/delivery-idempotency.spec.ts` | EDIT — quiet defer cases; cap/gap regressions |
| `modules/omnichannel/services/delivery-claim.spec.ts` | EDIT — assert quiet defer path; SQL unchanged unless D-2 |
| `modules/omnichannel/publication-automation.spec.ts` | EDIT only if shared helpers move (prefer import from `tehran-time`, no duplication) |
| `modules/omnichannel/gate-block-reason.ts` + `.spec.ts` | EDIT — optional: map claim quiet to operator `quiet` blocker when diagnosing |
| `modules/omnichannel/services/delivery-idempotency.integration.spec.ts` | EDIT — optional Postgres case: defer at claim, no send |
| `scripts/unit-specs.txt` | EDIT if new/changed specs |
| `docs/WORKLOG.md`, `docs/reports/2026-10-xx-omnichannel-pr5-cap-quiet.md` | EDIT/NEW — evidence |

**Do not touch:** `outbox-worker.service.ts` except import/type if `DeliveryDeferredError` reason widened (prefer not); adapters; token vault; `apps/web` (PR-10 UI); `.tmp-sms-panel/**`; SMS modules; `docker-compose.yml`; `scripts/auto-deploy.sh`; connector enable flags; live canary policy.

## 6. Migration needs

| Item | PR-5 |
| --- | --- |
| `attempt_started`, `lease_until` on `publication_delivery` | **Out of scope** — PR-4 (#124). PR-5 does not require them. If PR-4 lands columns, no PR-5 migration unless a new deferred reason needs enum constraint (today `deferredReason` is text — **no migration** expected). |
| New indexes | **None** |
| Backup gate | Standard deploy GO; **no DB backup required** for code-only PR unless PR-4 migration is combined (should not be). |

## 7. Open decisions (safe defaults)

| # | Question | Recommended default |
| --- | --- | --- |
| D-1 | Where to implement quiet at claim? | Extend **`planCreateSend`** (after stale, before cap) with `quietStartHour`/`quietEndHour` + `tehranHour(now)`; reuse `nextQuietEnd` for `availableAt`. Single code path for worker + tests. |
| D-2 | Do HOLD rows count toward daily cap at claim? | **Keep yes** (conservative, matches current SQL). Document in report; change only if Hamed wants HOLD to release cap slots. |
| D-3 | Rate limit scope | **Keep per connectionId** (provider throttle). Document; do not split per destination in PR-5. |
| D-4 | `automation.mode === 'OFF'` at claim | **Defer** with reason `automation_off` only if product owner confirms; otherwise **non-goal** (mode enforced at enqueue). Default PR-5: **no mode check at claim** to minimize scope. |
| D-5 | Feature flag | Stage2 mentions flag rollback — **no new env flag**; rollback = revert PR. Behavior is low-risk deferral only. |
| D-6 | Manual catalog publish quiet at enqueue | **Optional** align `manualPublish` / category requeue with quiet (better UX); **mandatory** fix at claim. Default: claim-only unless small change in `resolvePublishScopeForTargets` scheduling. |
| D-7 | Test fixtures | UUID v4 placeholders only; never copy production Bale/Rubika/Telegram destination keys from ops reports. |

## 8. Tests required

Unit (register in `scripts/unit-specs.txt`):

1. `planCreateSend` / quiet: inside window → `defer` `quiet_hours`; outside → unchanged.
2. `decideDailyCap` jitter with `quietEndHour` still valid (regression).
3. `delivery-claim.spec.ts`: `reserveCreateSend` passes quiet settings from resolved destination publish settings (mock dest/conn).
4. `nextCreateAvailableAt`: quiet window returns ≥ `nextQuietEnd`.
5. Optional: `gate-block-reason` quiet alignment when `tehranHourNow` in window.

Integration (Postgres-gated, skip without throwaway DB — never Iran prod):

6. Seed one PENDING CREATE; fix clock or pass `now` mock at service boundary if exposed; assert defer + no `PROCESSING` without send.

Pass bar: existing omnichannel unit specs green + `tsc` clean.

## 9. Must-do vs owner-gated

| Must-do (implementer, after PR-4 merge) | Owner-gated |
| --- | --- |
| Quiet hours at **claim** for all CREATE paths | Written **GO** before merge/deploy |
| `quiet_hours` deferred reason + tests | Confirm D-2 (HOLD counts toward cap) if changing SQL |
| Align `nextCreateAvailableAt` with quiet | PR-4 (#124) merged and stable on master |
| WORKLOG + session report | No live connector/canary enable for validation |
| | No invented destination IDs in panel or tests |

## 10. Rollback

Revert PR; no migration. Deliveries deferred with `quiet_hours` remain PENDING/RETRY with `nextAttemptAt` — harmless; operators can retry after revert (claim gate removed until redeploy).

## 11. Non-goals

Telegram **egress** / Worker custom domain / `TELEGRAM_API_URL` (PR-12); **token vault** / `OMNICHANNEL_VAULT_KEY` move; **SMS** and `.tmp-sms-panel/**`; **PR-14** bots/inbound/PFI; `attempt_started` / `lease_until` / auto-revive removal (PR-4); delete/edit/WITHDRAWN (PR-7); channel settings UI (PR-10); new `OMNICHANNEL_*` send flags; enabling connectors; live canary sends; outbox DELETE; mass requeue-by-category behavior changes; `apps/web` changes.

## 12. Sequence

1. Rebase on master with PR-4 merged.
2. Implement quiet in pure layer + wire `reserveCreateSend` + `nextCreateAvailableAt`.
3. Unit specs → optional integration.
4. Report + WORKLOG; **wait for GO** → deploy Iran only per runbook.
