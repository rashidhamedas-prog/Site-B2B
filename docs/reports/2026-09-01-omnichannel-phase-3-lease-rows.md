# Omnichannel Phase 3 — lease UPDATE RETURNING

Date: 2026-09-01  
Task: TASK-20260826-001

## Evidence on `88841aa`

- Persist SQL (`MARK_DONE_SQL`) is in the worker image. Heartbeats are fresh.
- `pg_stat_activity` shows both workers idle on the lease `UPDATE` every ~2s.
- 18 rows stay `PROCESSING` with empty `lastError`. Publications stay 0.
- TypeORM Postgres `query()` for `UPDATE` returns `[rows, rowCount]`, not `rows`.
- `leaseBatch` did `raw.map(r => r.id)` → `[]` → `find(In([]))` → empty handle loop.

## Change

`leaseRowsFromQueryResult` unwraps that tuple (and still accepts a plain row array).

## After deploy

Reset stuck Phase 3/4 `PROCESSING` rows to `PENDING` + `attempts=0`. Do not DELETE. Connectors stay off.
