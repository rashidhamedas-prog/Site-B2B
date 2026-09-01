# Omnichannel Phase 3 — persist outbox completion

Date: 2026-09-01  
Task: TASK-20260826-001

## Evidence on `079193a`

- API and both workers healthy. `OMNICHANNEL_CONNECTORS_ENABLED` / `OMNICHANNEL_AUTO_PUBLISH` unset.
- SMS `AbortSignal.timeout` and per-row `beat()` are in the worker image.
- 18 rows (`order.*`, `product.stock_changed`, `search.reindex.requested`) stayed `PROCESSING`.
- `lockedAt` jumped in 5-minute reclaim windows; `lastError` stayed empty; `updatedAt` stayed on 2026-08-31 / 09:59Z.
- Lease uses raw SQL (attempts/`lockedAt` changed). `markDone` / `markFailure` used `repository.update` and did not land.

## Change

- `OutboxService.markDone` / `markFailure` use the same `dataSource.query` path as lease.
- Worker handle timeout is 25s so customer+admin SMS can finish inside the race.
- Rows are not deleted. After deploy, operator reset is `PENDING` + `attempts=0`.

## Non-goals

- Connector flags stay off.
- Backup timer still needs `BACKUP_PASSPHRASE`.
- §9 business decisions and destination canary are owner-gated.
