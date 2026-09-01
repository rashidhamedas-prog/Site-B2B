# Omnichannel Phase 2 — catalog outbox wiring

Date: 2026-09-01  
Task: TASK-20260826-001  
Branch: `ai/TASK-20260826-001-product-outbox`

## Why

Phase review on 2026-09-01 marked Phase 2 **FAIL**: `productOutboxIntents` existed but `ProductService` never called it. Create/update/remove still indexed Meilisearch on the API request path. Inventory/order/blog/CMS producers were already wired.

## What changed

- `create` / `update` / `remove` write the product row and enqueue catalog + `search.reindex.requested` events in the same `EntityManager` transaction.
- `SearchService` is no longer injected into `ProductService`. Search stays on the Phase 3 worker.
- Lease SQL: `PROCESSING` + `lockedAt IS NULL` is reclaimable on the next tick; a set lock is reclaimable after 5 minutes.
- Worker `handle()` has a 90s timeout so a hung SMS/search call cannot pin `running=true` forever. The original call is not cancelled (duplicate SMS risk).
- Color-gallery merge (`mergeColorImagesIntoProduct`) now enqueues `product.media_changed` in the same txn as the image save.
- `connector-gate.spec.ts` added (was claimed, missing). Bale/Rubika stay `ConnectorDisabledError`.

## Not changed

- `OMNICHANNEL_CONNECTORS_ENABLED` / `OMNICHANNEL_AUTO_PUBLISH` stay off.
- Slug 301 still uses `changeSlugInTransaction` after the product+outbox commit.
- `ProductSearchIndexer.onModuleInit` still bulk-indexes on API boot if Meilisearch is ready.

## Tests run

```
cd apps/api
npx ts-node --transpile-only src/modules/product/product-outbox.spec.ts
npx ts-node --transpile-only src/modules/omnichannel/services/outbox-lease.spec.ts
npx ts-node --transpile-only src/modules/omnichannel/omnichannel-phase-acceptance.spec.ts
npx tsc --noEmit
```

All four exited 0.

## Rollback

Set `OMNICHANNEL_OUTBOX_PRODUCER=false`. Search will lag until the worker drains existing events. Do not delete outbox rows.

## Architect 2026-09-01

`/omnichannel-architect` (`f1f8fcba-fe39-40de-826e-a463ff557db2`): Phase 2 **PASS WITH CONDITIONS**.

Conditions: not live yet; slug 301 stays outside the outbox txn; `ProductSearchIndexer` still boots Meilisearch; tests are source scans not Postgres rollback; independent Reviewer + Security still required.

Phase 3: lease+timeout are necessary, not sufficient. After deploy, inspect the 9 PROCESSING rows; reset only with owner SQL (`PENDING`, do not DELETE). Restart soak. Do not enable connectors.

## Reviewer 2026-09-01

`/omnichannel-phase-reviewer` (`a161b6bb-dfa5-4a3f-8006-51aab9169328`): Phase 2 **PASS WITH CONDITIONS**. Phase 3 residual **PASS**. Must-fix: none.

Optional residuals: boot Meilisearch indexer; slug 301 after outbox; hung `handle()` is not aborted (duplicate SMS risk); acceptance specs are source scans.

Live ops: deploy API + both workers; flags stay off; SELECT the 9 PROCESSING rows; reclaim Phase 3/4 only; never DELETE; never lease `publication.deliver.requested` by enabling connectors.

## Do not Done

24h soak after this deploy, destination canary, §9 decisions, independent Security on the live SHA.
