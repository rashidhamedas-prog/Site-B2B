# Retail Business Rules

Discover and document actual rules; the following are verification categories, not invented requirements.

- Product/channel visibility, variants, media, attributes, availability, and search/category behavior.
- Customer/guest identity, addresses, consent, account history, and access boundaries.
- Price source, currency/rounding, tax inclusion, promotions/coupons, stacking, expiry, usage, and refund allocation.
- Inventory availability/reservation/release, oversell/backorder/preorder behavior, and concurrency.
- Cart merge, persistence, recalculation, quantity bounds, unavailable items, and stale-price handling.
- Checkout validation, shipping methods, tax, payment attempts, retries, duplicate submission, and accessible error recovery.
- Order lifecycle, cancellation, fulfillment, notifications, returns, exchanges, partial/full refunds, and reconciliation.

## Retail acceptance matrix

Test representative simple/variant products, guest/account if supported, mobile/desktop, promotion/no promotion, in/out-of-stock, successful/declined/interrupted payment, duplicate callback/submission, cancellation/refund, and order visibility. Verify authoritative totals at every transition and no order/payment duplication. Mark non-applicable cases with business-owner evidence.

Preflight must identify the owner and claimed implementation/test files for every retail journey changed. Record partial or failed journeys in the checkpoint handoff; do not mark the task complete because wholesale alone passes.
