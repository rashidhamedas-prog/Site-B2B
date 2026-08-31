# Omnichannel Phase 2 — transactional outbox producers

Date: 2026-08-26  
Task: TASK-20260826-001  
Branch: `ai/TASK-20260826-001-omnichannel-phase-0`

## What changed

- `OutboxService.enqueue` writes `omnichannel_outbox_events` in the same `EntityManager` as the business write. Unique `dedupeKey` (`operationId:eventType:aggregateId:channel`) treats `23505` as idempotent retry.
- Payload sanitizer strips jwt/token/password/phone/email and other forbidden keys.
- Producer flag: `OMNICHANNEL_OUTBOX_PRODUCER=false` stops new rows (events are not deleted).
- Request-path side effects moved off the API:
  - Product create/update/remove → outbox (`product.*` + `search.reindex.requested`); no Meilisearch on the request.
  - Inventory adjust/set/reversal → `product.stock_changed` + search reindex.
  - Checkout / cancel / status / tracking / payment verify → notification and affiliate intents in the same transaction as stock/payment.
  - Blog publish / CMS publish → `blog.published` / `cms.published`.
  - `AffiliatePostbackService.fireForOrder` only enqueues. HTTP lives in `deliverForOrder` for the Phase 3 worker.

## Acceptance

- Fault-injection spec: business write + outbox in one txn; injected failure rolls both back.
- Same operation key does not insert a second outbox row (`23505` → deduped).
- API `tsc --noEmit` recorded in handoff after this report.

## Rollback

Set `OMNICHANNEL_OUTBOX_PRODUCER=false`. Do not delete existing events.

## Not in this phase

Worker consumption (Phase 3). Until the worker runs, SMS / affiliate HTTP / Meilisearch from these events stay queued.
