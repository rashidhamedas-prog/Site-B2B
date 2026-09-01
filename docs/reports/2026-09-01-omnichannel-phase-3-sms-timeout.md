# Omnichannel Phase 3 — unstick hung SMS/search handles

Date: 2026-09-01  
Task: TASK-20260826-001  
Branch: `ai/TASK-20260826-001-phase3-sms`

## Live evidence before this change

- SHA `6254120` (PR #68) deployed. API 200. Connectors off.
- 18 `PROCESSING` rows: order notifications, `product.stock_changed`, `search.reindex.requested`.
- `lastError` empty. Attempts up to 261. Timeout string was in the worker image.

## Root cause

`NotificationService.post` called `fetch` with no abort. `tick()` wrote the health heartbeat only in `finally`, after the whole leased batch. One hung SMS kept `running=true` and froze heartbeat updates for the entire batch.

## Fix

- SMS fetch: `AbortSignal.timeout(8000)`.
- Meilisearch client: `timeout: 8000`.
- Worker heartbeat on init, at tick start, and after every row.
- Handle timeout 15s (was 90s).

## After deploy

Reset remaining Phase 3/4 `PROCESSING` rows to `PENDING` if they are still stuck. Do not DELETE. Do not enable connectors. Restart the soak clock.
