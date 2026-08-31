# Omnichannel Phase 3 — independent outbox worker

Date: 2026-08-26  
Task: TASK-20260826-001  
Branch: `ai/TASK-20260826-001-omnichannel-phase-0`

## What changed

- Lease: `FOR UPDATE SKIP LOCKED` on Phase 3 event types only. Publication events (`product.created`, `blog.published`, …) stay `PENDING` for Phases 4–6.
- Stale `PROCESSING` locks older than 5 minutes are reclaimed.
- Retry: exponential backoff (`2^attempts` seconds, cap 1h). After `maxAttempts` (8) the row is `DEAD`.
- Separate process: `apps/api/src/worker.main.ts` + Compose service `worker` (`OMNICHANNEL_WORKER=true`). The API process does not poll the outbox.
- Handlers: Meilisearch reindex/remove, order SMS (phone loaded in the worker, not stored in the payload), affiliate HTTP via `deliverForOrder`.
- `scripts/auto-deploy.sh` builds and starts `worker` with `api`/`web`.

## Acceptance

- `outbox-lease.spec.ts`: backoff, dead-letter, SKIP LOCKED SQL, publication types excluded.
- Worker starts only when `OMNICHANNEL_WORKER=true`.

## Rollback

Stop the `worker` container. Events remain in the table. Producers can be disabled separately (`OMNICHANNEL_OUTBOX_PRODUCER=false`).

## Not in this phase

Telegram/Bale/Rubika delivery, Retail/Wholesale projections, Admin reconcile, deploy hardening beyond starting the worker.
