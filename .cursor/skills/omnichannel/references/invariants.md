# Omnichannel invariants

## Stock and price

- Shared resolver: `channelAvailability(product, channel)` in `apps/api/src/modules/product/channel-product-projection.ts`.
- Feed and Basalam must import that resolver. Do not sum `retailStock` privately or fall back to product-level stock when every variant is 0.
- Public `GET /products` requires `channel=RETAIL|WHOLESALE` except admin JWT. Opposite-channel fields are stripped.

## Transactions

- Variant reload and `syncProductStockFromVariants` share the same `EntityManager` as the stock UPDATE.
- Stock change and `inventory_movements` insert are one transaction. Checkout SALE writes a movement.
- Movements are immutable; reverse with `REVERSAL`, never hard-delete.

## Outbox / worker

- Producers enqueue in the same transaction as the business write.
- Worker is a separate process (`OMNICHANNEL_WORKER=true`). Lease uses `FOR UPDATE SKIP LOCKED`.
- TypeORM `UPDATE … RETURNING` may be a `[rows, rowCount]` tuple — use `leaseRowsFromQueryResult`.
- `markDone` / `markFailure` persist with raw SQL like lease.
- SMS and Meilisearch have hard timeouts. Heartbeat after each row.

## Secrets

- `secretRef` matches `^(TELEGRAM|BALE|RUBIKA)_[A-Z0-9_]{1,80}$`.
- GET destinations omit raw `settings` except safe `isCanary`.
- Outbox payload strips jwt/token/password/phone/email.
