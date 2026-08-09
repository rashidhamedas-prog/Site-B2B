# Catalog, Inventory, Order, and Payment

## Cross-channel invariants

- Stable product/variant/SKU identifiers and an explicit source of truth; publication is distinct from stock availability.
- Money uses fixed precision/minor units with explicit currency and rounding. Store the priced order snapshot needed for history and refunds.
- Inventory operations define available/on-hand/reserved/allocated states, atomicity, reservation expiry, release, reconciliation, and channel contention.
- Order state transitions are explicit, authorized, auditable, and reject illegal/repeated transitions.
- Payment attempt, authorization, capture, failure, void, refund, and chargeback are not conflated with order status.
- Every mutation endpoint, job, webhook, and retry-prone consumer has an idempotency strategy.

## Failure cases to test

Price/stock changes during checkout; last-unit race; payment succeeds but response is lost; duplicate/out-of-order webhook; capture/refund timeout; partial refund; cancellation after allocation; retrying workers; third-party outage; stale cache/search data; mismatched amount/currency; inventory reconciliation discrepancy.

Maintain a state-transition table for order, payment, fulfillment, return, and inventory reservation with trigger, guard, side effects, idempotency key, audit event, compensation, and tests.

Because these domains overlap both channels, task claims must cover shared state-machine/domain files plus every affected adapter and regression test. Coordinate rather than concurrently editing shared commerce primitives under separate tasks.
