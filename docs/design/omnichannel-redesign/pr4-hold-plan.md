# PR-4 — No auto-revive / HOLD on unknown (plan + delta)

Source: `stage2-design.md` §5.2 + §6 (row PR-4) · `pr-execution-queue.md` row 4 · repo at `0c8a7d3a` (master, PR-3 live).
Gate: CODE (no DB migration). Merge/deploy only with Hamed's written GO. No connector flags, no Telegram egress/vault, no SMS, no PR-14, no mass retry, no invented destination IDs.

## 0. Headline finding

Most of PR-4 already exists. The **HOLD-on-unknown** half shipped with the 2026-10-25 dedup work and was hardened in PR-3:

- `reserveCreateSend` sees a `PROCESSING` CREATE on lease reclaim → `markCreateUnconfirmed` → HOLD `uncertain_after_timeout`, no adapter call.
- Handle/adapter timeouts (`isUnconfirmedSendError`) → HOLD + outbox DONE, never RETRY.
- `planCreateSend` → HOLD `stale_needs_reapproval` after `OMNICHANNEL_STALE_DELIVERY_HOURS` (24h default).
- HOLD is never in the reusable set (`DEAD`, `FAILED` only); only an Owner reapprove moves it.

The real gap is the **bulk revive** half: `POST /omnichannel/outbox/revive-connector-disabled` re-queues up to **500** DEAD `connector is disabled` CREATEs per call (UI sent 200). Stage2: *«revive فقط endpoint تکی با LIMIT 1 و دلیل»*; queue UI: *«بدون دکمه revive گروهی … در حالت عادی»*. So PR-4 is a **small delta**, not greenfield.

## 1. Acceptance criteria

1. Revive of DEAD `connector_disabled` rows takes **exactly one row per call** (oldest first), requires `confirm` + non-empty `reason`, whatever `limit` the client sends. (API + `OutboxService.requeueConnectorDisabledDead` helper.)
2. Legacy batch behaviour returns **only** with env `OMNICHANNEL_BULK_REVIVE_ENABLED=true` (exact string; default off) — this is the rollback flag.
3. Revive never touches HOLD rows (selects `status='DEAD' AND action='CREATE'`); HOLD only via the existing Owner reapprove.
4. Uncertain outcomes → HOLD `uncertain_after_timeout`, never RETRY/PENDING: timeout, abort, **connection reset / socket hang up / EPIPE / gateway 502-504** (request may have landed). `ECONNREFUSED` / DNS failures stay hard errors (nothing was sent). `unsupported_media` unchanged.
5. Stale/PROCESSING-on-reclaim path has a real-source test (already in `delivery-claim.spec.ts`; keep green).
6. Response of the revive endpoint reports `limitApplied` and `bulk` so the UI/audit can show which mode ran; audit event carries `limit` + `bulk`.
7. Admin UI asks for one row (`limit: 1`) and says so.

## 2. Already covered vs gaps

| Area | Already in repo | Gap |
| --- | --- | --- |
| PROCESSING on reclaim → HOLD | `reserveCreateSend` + harness test | none |
| Timeout → HOLD | worker catch + inner CREATE catch, `isUnconfirmedSendError` | regex missed ECONNRESET / socket hang up / EPIPE / 502 / 504 → these became RETRY and could duplicate a CREATE |
| Stale → HOLD | `planCreateSend` | none |
| HOLD never reused | `REUSABLE = DEAD, FAILED` | none |
| Bulk revive | `reviveConnectorDisabledDead` (limit ≤500), `OutboxService.requeueConnectorDisabledDead` (≤500, unused helper) | **this PR** |
| UPDATE/DELETE timeout | worker ACKs outbox; delivery keeps `RETRY` written by `markDeliveryFailure` | **not changed** (see §6) |

## 3. File claims (implementer)

All under `apps/api/src/modules/omnichannel/` unless noted.

| File | Action |
| --- | --- |
| `delivery-hold-policy.ts` (+ `.spec.ts`) | NEW — `isBulkReviveEnabled`, `effectiveReviveLimit`, constants |
| `services/omnichannel.service.ts` | EDIT, narrow: `reviveConnectorDisabledDead` only |
| `services/outbox.service.ts` (+ `.spec.ts`) | EDIT, narrow: `requeueConnectorDisabledDead` limit |
| `services/publication-deliver.ts` (+ `.spec.ts`) | EDIT — widen `isUnconfirmedSendError` |
| `services/delivery-claim.spec.ts` | EDIT — revive-limit harness |
| `apps/web/src/components/admin/AdminOmnichannel.tsx` + `admin-omnichannel-connector-disabled.spec.ts` | EDIT — `limit: 1`, copy |
| `apps/api/scripts/unit-specs.txt` | EDIT — register new spec |
| `docs/WORKLOG.md`, `docs/reports/2026-10-28-omnichannel-pr4-hold.md`, this plan, `.ai-dos/tasks/active.yaml` | EDIT/NEW |

Do **not** touch: `outbox-worker.service.ts`, `outbox-lease.ts` (lease_until / `attempt_started` column is a later, DB-backed slice), adapters, token vault, migrations, `requeueByCategory`, `auto-deploy.sh`, SMS, `.tmp-sms-panel/**`.

## 4. Feature flag and rollback

- `OMNICHANNEL_BULK_REVIVE_ENABLED` — default **unset = off** (new, safe behaviour). Set to exactly `true` to restore the old ≤500 batch. Takes effect on api restart; no DB change.
- HOLD-widening has no flag: it is strictly more conservative (more rows wait for a human). Rollback = `git revert`.
- No migration, so no `down()`.

## 5. Tests

- `delivery-hold-policy.spec.ts`: flag parsing (only `true`), clamp to 1 for any input when off, legacy bounds when on.
- `delivery-claim.spec.ts`: real `reviveConnectorDisabledDead` with fake query builder — `take(1)`, only oldest reactivated, scoped to DEAD CREATE; rollback flag restores 200/3 rows.
- `outbox.service.spec.ts`: helper selects `LIMIT 1` by default.
- `publication-deliver.spec.ts`: reset/socket/502/504 unconfirmed; ECONNREFUSED/ENOTFOUND/unsupported_media not.
- Web source spec: `limit: 1`, no `limit: 200`.
- Run: `npx ts-node --transpile-only <spec>` per file; `scripts/unit-specs.txt` is the CI list.

## 6. Out of scope / open (owner-gated or later)

- **`attempt_started` / `lease_until` columns** (stage2 §5.2 first bullets): needs a migration; the current 5-minute outbox lock + PROCESSING-implies-HOLD already gives the HOLD guarantee. Candidate follow-up with PR-5.
- **UPDATE/DELETE timeouts**: stage2 only forbids auto-retry for CREATE. Today the outbox row is ACKed and `markDeliveryFailure` leaves the delivery `RETRY` with no live outbox event (orphan). Needs a decision (HOLD vs requeue) — and interacts with the PR-3 active-mutation unique index (a HOLD DELETE would block an identical DELETE). Not changed here.
- **`requeueByCategory`** is another bulk path (new publishes, not revive). Stage2 puts it behind an Owner switch → PR-6 (roles/GO-ref).
- Reapprove of HOLD stays a single-row Owner action with reason; no bulk reapprove added.
- Deploy: needs Hamed's written GO for the exact commit and the approval file on Iran.
