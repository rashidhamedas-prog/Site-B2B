# PR-3 Idempotency — file plan (plan only, no code)

Source: `stage2-design.md` §5.1/§5.2/§6 · `pr-execution-queue.md` row 3 · `stage1-requirements.md` REQ-Q1 · repo state at `e3a23169` (master + hotfix #119 branch).
Gate: CODE + **DB backup (owner)**. Depends on hotfix PR #119 merged and deployed with GO. No merge/deploy without Hamed's written GO.

## 0. Headline finding

**Most of PR-3 already shipped on 2026-10-25** (WORKLOG "یکتایی ارسال بله/روبیکا", migration `20261025-001-omnichannel-delivery-idempotency.ts`, applied on Iran with backup `20261025T113411Z`; 139 CREATE → 98 keepers / 41 losers). So PR-3 is **not** a greenfield migration. It is a **delta/hardening PR** that closes the gaps below and adds the missing proof (concurrency + restart tests). The implementer must not re-create the existing index, undo table, or key builder.

## 1. Acceptance criteria

REQ-Q1 (P0): key `CREATE:destinationId:productId` and `UPDATE/DELETE:messageId[:contentHash]` without `Date.now()`; atomic claim `UPDATE … WHERE status IN (PENDING,RETRY) … RETURNING`; acceptance = two-worker race + restart mid-send = **zero duplicates**; second CREATE for a product+channel with an active delivery is blocked or redirected to edit.

Concrete, testable criteria for this PR:

1. No idempotency/dedupe key contains time or randomness (static scan test over `buildIdempotencyKey`, `buildDedupeKey` call sites).
2. At most one active CREATE per `(sourceType, sourceId, destinationId)` — enforced by DB, not only by app code (already true; keep green).
3. At most one active UPDATE and one active DELETE per `(destinationId, providerMessageId)` — **new DB guarantee**.
4. DELETE key is `DELETE:{destinationId}:{messageId}:` (no content hash) so retries of the same delete collapse.
5. Two concurrent `reserveCreateSend` on one delivery → exactly one `send`, the other `stop`.
6. Worker restart / lease reclaim while a CREATE is PROCESSING → delivery goes HOLD `uncertain_after_timeout`, **never** a second adapter call.
7. Reapprove/reactivate racing a live sibling never surfaces a raw Postgres 23505 to the admin (returns superseded/skip with audit).
8. Re-CREATE after an admin DELETE has a defined, tested outcome (see decision D-2) — not a silent `0`.
9. Migration is additive, idempotent (`IF NOT EXISTS`), reversible via `down()`, deletes no rows.

## 2. Already covered vs gaps

| Area | Already in repo | Gap for PR-3 |
| --- | --- | --- |
| CREATE key | `buildIdempotencyKey` in `delivery-idempotency.ts`: `CREATE:{sourceType}:{sourceId}:{destinationId}` — no time | Format differs from stage2 text (`destinationId:productId`). **Keep as is** (live index data uses it). Amend design doc wording. |
| CREATE unique | Partial UNIQUE `UQ_omnichannel_deliveries_active_create` on `idempotencyKey` for `PENDING/PROCESSING/RETRY/SUCCEEDED/HOLD`, `action='CREATE'`, `supersededAt IS NULL` (`delivery-dedupe-sql.ts`, migration, entity `@Index`); insert uses `ON CONFLICT … DO NOTHING` | none |
| Enqueue decision | `decideCreateEnqueue`: skip / convert_update / merge / reuse / insert, under `pg_advisory_xact_lock(hashtext(key))` in `enqueueOneDelivery` | none (add tests for races, §6) |
| Outbox key | `buildDedupeKey` = `operationId:eventType:aggregateId:channel`, unique `UQ_omnichannel_outbox_dedupeKey`, `enqueue` uses `orIgnore` | Unique spans **all** statuses incl. DONE → see D-2 |
| Outbox claim | `buildLeaseSql`: CTE + `FOR UPDATE SKIP LOCKED` + `UPDATE … RETURNING` (atomic, multi-worker safe); `MARK_DONE/FAILURE` SQL | Reclaims PROCESSING after 5 min fixed interval; no per-row lease column (design `lease_until`) → deferred to PR-4 (D-4) |
| Delivery claim | `reserveCreateSend`: advisory locks (key + daily cap), siblings check, cap/gap/rate/stale plan, then `UPDATE … WHERE status IN ('PENDING','RETRY') RETURNING id` | `row` is read **outside** the tx (stale status possible); re-read with `FOR UPDATE` inside tx |
| Restart mid-send | PROCESSING seen on reclaim → `markCreateUnconfirmed` → HOLD `uncertain_after_timeout`; timeout/unconfirmed errors → HOLD (not RETRY); HOLD never auto-reused (`REUSABLE = DEAD, FAILED`) | No test that exercises the real reclaim path end-to-end; only simulated in `delivery-claim.spec.ts` |
| Backfill/undo | `omnichannel_delivery_dedupe_undo`, losers → DEAD `superseded_duplicate` (or keep SUCCEEDED + `supersededAt`), `down()` restores | Reuse the same pattern for the new index |
| UPDATE/DELETE | Keys `UPDATE:{dest}:{msgId}:{hash}`, `DELETE:{dest}:{msgId}:{hash}`; dedupe only via outbox `dedupeKey` | **No delivery-level UNIQUE** for UPDATE/DELETE. DELETE key includes hash of empty render (inconsistent with migration backfill `DELETE:d:m:`). |
| Reactivate | `REACTIVATE_CREATE_SQL` clears `supersededAt`, sets PENDING; sibling SUCCEEDED check first | A concurrent active sibling (non-SUCCEEDED) can make it hit the partial UNIQUE → raw 23505 |
| Revive | `reviveConnectorDisabledDead` goes through `reactivateDelivery` | covered by the same 23505 handling |
| Tests | `delivery-idempotency.spec.ts` (decisions), `delivery-claim.spec.ts` (simulated), migration spec (SQL string asserts), `outbox.service.spec.ts`, `outbox-lease.spec.ts` | No DB-backed concurrency/restart test; no UPDATE/DELETE index test |

Out of PR-3 even though adjacent: `attempt_started`/`lease_until`, auto-revive removal, HOLD semantics → **PR-4**. Cap/quiet at claim → PR-5.

## 3. Files to claim (for the implementer)

Register the task in `.ai-dos/tasks/active.yaml` first (one owner, branch `feat/omnichannel-pr3-idempotency`, worktree, these `file_claims`). `omnichannel.service.ts`, `reserve-create-send-sql*` are currently modified by the hotfix branch — **start only after #119 is merged and rebase on master**.

All under `apps/api/src/`:

| File | Action |
| --- | --- |
| `modules/omnichannel/delivery-idempotency.ts` | EDIT — DELETE key without hash; keep CREATE format; export `ACTIVE_MUTATION_*` if needed |
| `modules/omnichannel/delivery-dedupe-sql.ts` | EDIT — add `ACTIVE_MUTATION_INDEX_NAME` / `_PREDICATE` and a dry-run SQL for UPDATE/DELETE collisions (keep CREATE constants untouched) |
| `database/migrations/20261028-001-omnichannel-mutation-idempotency.ts` | NEW — additive partial UNIQUE (see §4) |
| `database/migrations/20261028-001-omnichannel-mutation-idempotency.spec.ts` | NEW |
| `modules/omnichannel/entities/publication-delivery.entity.ts` | EDIT — add the new `@Index` (declaration only; `synchronize` is off in prod) |
| `modules/omnichannel/services/omnichannel.service.ts` | EDIT, narrow: `reserveCreateSend` (re-read under lock), `reactivateDelivery` (23505 handling), `enqueueOneDelivery` (only if D-2 needs it) |
| `modules/omnichannel/services/reserve-create-send-sql.ts` + `.spec.ts` | EDIT only if a new locked-select SQL constant is added (keep casts: avoid 42P08) |
| `modules/omnichannel/delivery-idempotency.spec.ts` | EDIT — key tests |
| `modules/omnichannel/services/delivery-claim.spec.ts` | EDIT — replace simulation with real-SQL assertions; add restart/reclaim case |
| `modules/omnichannel/services/delivery-idempotency.integration.spec.ts` | NEW — Postgres-gated (skip when no `DATABASE_URL`), follow `sales-partner-integrity.integration.spec.ts` |
| `modules/omnichannel/services/outbox-lease.spec.ts` | EDIT only if lease SQL changes (not expected) |
| `scripts/unit-specs.txt` | EDIT — register new specs |
| `docs/WORKLOG.md`, `docs/reports/2026-10-xx-omnichannel-pr3-idempotency.md` | EDIT/NEW — evidence + rollback |
| `docs/design/omnichannel-redesign/stage2-design.md` | one-line fix: key format note (optional) |

Do **not** touch: `outbox-worker.service.ts` (PR-4 owns lease/HOLD changes), adapters (`telegram|bale|rubika`), `omnichannel-token-vault*`, anything under `apps/web`, `.tmp-sms-panel/**`, SMS modules, `docker-compose.yml`, `scripts/auto-deploy.sh`.

## 4. Migration sketch (additive UNIQUE)

Name `20261028-001-omnichannel-mutation-idempotency.ts` (latest existing is `20261027-004`); class name follows the repo's epoch-suffix convention.

`up()`:
1. `CREATE TABLE IF NOT EXISTS` reuse of `omnichannel_delivery_dedupe_undo` (already exists; rows keyed by `deliveryId`, `ON CONFLICT DO NOTHING`).
2. Snapshot losers: among `action IN ('UPDATE','DELETE')`, `supersededAt IS NULL`, status in `PENDING/PROCESSING/RETRY/HOLD`, group by `idempotencyKey`; keep the **newest** per key (an unsent edit that has been replaced is stale). Losers → `DEAD`, `lastError='superseded_duplicate'`, `supersededAt=NOW()`; linked outbox not `DONE` → `DEAD`. **No DELETE FROM.**
3. Normalize legacy DELETE keys to `DELETE:{dest}:{msgId}:` only where the new format would differ and no collision results (guard with the same dry-run).
4. `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_omnichannel_deliveries_active_mutation" ON "omnichannel_publication_deliveries" ("idempotencyKey") WHERE "action" IN ('UPDATE','DELETE') AND "status" IN ('PENDING','PROCESSING','RETRY','HOLD') AND "supersededAt" IS NULL`.
   SUCCEEDED is intentionally **excluded** (repeat edits with changed content must stay possible; same-content repeats are already collapsed by the outbox `dedupeKey`).
   Table is ~240 rows, so a plain (non-CONCURRENTLY) build under the migration transaction is fine; lock is momentary.

`down()`: `DROP INDEX IF EXISTS` the new index; restore losers from the undo table where `lastError='superseded_duplicate'` (same pattern as the existing `down()`). Do **not** drop the CREATE index, columns, or undo table (owned by `20261025-001`).

Pre-flight (read-only, before the owner approves the run): run the new dry-run SQL on Iran and attach the loser count to the report. Expect 0–few rows; if > 0, list SKU/destination for Hamed before proceeding.

### Backup requirement (hard gate)
- Owner (not the agent) confirms a **fresh, listable** `scripts/backup-postgres.sh` dump on Iran (`185.213.167.61`, `/opt/taranom`) taken **after** hotfix #119 is deployed and **immediately before** migration; record the timestamp name (format `YYYYMMDDTHHMMSSZ`) in the report.
- Migration runs only through the existing gated deploy (written GO + matching `deploy-approval.json`); drain the worker first (existing drain flow). No `TARANOM_DEPLOY_FORCE`, no mass retry of outbox, `worker-b` stays off.
- Rollback = `down()` migration, then revert image; restore from dump only if data is damaged.

## 5. Open decisions (safe defaults, panel-configurable, no invented IDs)

| # | Question | Recommended default |
| --- | --- | --- |
| D-1 | Add a UNIQUE for UPDATE/DELETE at all? | Yes, as in §4. Safe: only active, non-SUCCEEDED rows. |
| D-2 | Re-CREATE after admin DELETE: today `supersedeCreatesAfterDelete` sets `supersededAt`, then a new CREATE reuses the same `idempotencyKey` → outbox `dedupeKey` already exists (even if DONE) → `enqueue` returns `deduped` → `enqueueOneDelivery` returns 0 silently. **Verify with a failing test first** (I did not reproduce it end-to-end). | If confirmed: add a non-time **generation** (count of superseded CREATE rows for the key) to the *outbox* `operationId` only, or reopen the old outbox row like the `reuse` path. Never use time/random. If PR-7 is the better home, record it there and keep PR-3 test as `expected-fail`/documented. |
| D-3 | Key shape `CREATE:{sourceType}:{sourceId}:{destinationId}` vs stage2 `CREATE:{destinationId}:{productId}` | Keep current. Update the doc, not the data. |
| D-4 | `attempt_started`, `lease_until`, per-row lease | Defer to PR-4. PR-3 only proves the existing reclaim → HOLD path. If PR-4 needs a column, it adds it additively there. |
| D-5 | Stale-lease window (currently fixed 5 min in lease SQL) and `HANDLE_TIMEOUT` | Leave unchanged. If later made configurable, store in panel/global settings via `loadStoredSettings`, not new env (matches the "no second source of truth" rule used for daily cap). |
| D-6 | Destination/canary IDs in tests and docs | Tests use generated UUID fixtures only. Do not copy the Bale canary id from the hotfix report into code, SQL, or fixtures. Real destinations come from the admin panel. |
| D-7 | Behavior when a second CREATE hits an active SUCCEEDED row with different content | Keep `convert_update` (existing). Panel wording belongs to PR-2/PR-9, not here. |

## 6. Tests required

Unit (register in `scripts/unit-specs.txt`; runner style `npx ts-node --transpile-only <file>`):
1. `delivery-idempotency.spec.ts`: CREATE key stable across calls; DELETE key ignores hash; UPDATE key changes with hash; no `Date.now`/`Math.random` in key builders (source scan).
2. Migration spec: `up()` has `CREATE UNIQUE INDEX IF NOT EXISTS`, exact predicate constant, no `DELETE FROM`, undo snapshot before supersede; `down()` drops only the new index and restores from undo; CREATE index untouched.
3. `delivery-claim.spec.ts`: assert the real claim SQL contains `status IN ('PENDING','RETRY')` + `RETURNING id`; casts present (regression for 42P08); PROCESSING-on-reclaim → `markCreateUnconfirmed` path.
4. `reactivateDelivery`: 23505 from `REACTIVATE_CREATE_SQL` → returns superseded result + audit, no throw.

Integration (Postgres-gated, skipped without DB; run locally/CI, **never against Iran prod**):
5. Two concurrent `reserveCreateSend` (Promise.all, two connections) on one PENDING delivery → exactly one `send`.
6. Two concurrent `enqueueOneDelivery` for same product+destination → exactly one active CREATE row, one outbox row.
7. Simulated restart: delivery PROCESSING + outbox `lockedAt` older than 5 min → lease reclaim → `reserveCreateSend` returns `stop`, delivery HOLD `uncertain_after_timeout`, adapter mock call count = 0.
8. Two concurrent active UPDATE (same message) / DELETE (same message) → one row survives, second deduped.
9. D-2 scenario: CREATE → SUCCEEDED → DELETE → CREATE again: asserts the chosen behavior.
10. Migration up/down on a seeded DB: losers superseded not deleted; down restores statuses; second `up()` is a no-op.

Pass bar: all specs above green + existing omnichannel specs (`reserve-create-send-sql`, `outbox.service`, `outbox-lease`, `publication-deliver`) unchanged; `tsc` clean.

## 7. Non-goals

Telegram egress / Worker domain / `TELEGRAM_API_URL` (PR-12), token vault move, `TELEGRAM_MEDIA_UPLOAD_MODE=upload`, SMS and `.tmp-sms-panel`, bots (PR-14), auto-revive removal and `attempt_started` (PR-4), cap/quiet at claim (PR-5), delete/edit endpoints and `WITHDRAWN` (PR-7), `apps/web` UI, new env flags, connector enabling, live canary sends, outbox DELETE, mass requeue.

## 8. Rollback

Code: revert PR. DB: `down()` of the new migration (drops only the new index and restores superseded UPDATE/DELETE rows from the undo table). Last resort: restore the pre-migration dump. Revert also needs GO to deploy.

## 9. Sequence for the implementer

1. Wait for #119 merged + deployed + green post-deploy checks; rebase.
2. Claim task/files in `.ai-dos/tasks/active.yaml`.
3. Write the failing tests (5–9) first; confirm D-2 behavior.
4. Implement key/DELETE change, reserve re-read, 23505 handling, migration.
5. Run unit + integration locally; attach dry-run result from Iran (read-only, with GO).
6. Draft PR, WORKLOG + report. Owner takes the backup → GO → gated deploy → verify `/v1/health`, outbox counts, no new `superseded_duplicate` surprises.
