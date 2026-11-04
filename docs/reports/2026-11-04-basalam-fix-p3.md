# Basalam fix P3 — stock correctness

Branch `ai/basalam-fix-p3` (stacked on P2). No deploy, no live Basalam calls.

## Invariant (unchanged)
Basalam stock = `channelAvailability(product, 'RETAIL').stock` (sum of variants' `retailStock`). `wholesaleStock` and legacy `stock` never count.

## Change
- `createSkipReason(retailStock)` → `'موجودی تکی صفر'` when stock ≤ 0 / NaN.
- push-catalog: pending rows that are not already on the stall and have zero retail stock are skipped **before batching** (so they never consume the `limit` slots and block real creates). Rows matched to an existing stall product are still mapped. Defensive re-check before photo upload. Response adds `skipped` + `skippedSample[{sku, reason}]`.
- Dry-run push applies the same guard (`skipped`, `skippedSample`).
- sync-inventory unchanged: sending stock 0 to an existing mapped product is correct (marks it unavailable).
- Admin `AdminBasalamCatalog`: amber box with skipped count and up to 20 SKUs + reason.

## Per-variant stock — not implemented (documented)
Official SDK create shape: `variants: [{ primary_price, stock, sku?, properties: [{ property: str, value: str }] }]`; update via `PATCH /v1/products/{id}/variations/{variation_id}` (`primary_price`, `stock`, `sku`). Unconfirmed: whether `property` is a free title or must match category-defined properties, and how variation ids are returned after create. Kept product-level sum per spec until verified on a draft product.
