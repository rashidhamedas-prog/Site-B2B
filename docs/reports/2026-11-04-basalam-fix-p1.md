# Basalam fix P1 — price unit (Rial)

Branch `ai/basalam-fix-p1`. No deploy, no live Basalam calls.

## Problem
DB prices are IRR, but `buildCreatePayload` (catalog) and `syncInventory` (service) divided by 10, so Basalam received Toman (10× too cheap). Bulk/fallback PATCH also sent `price` instead of `primary_price`.

## Change
- `toBasalamPriceRial(irr)`: integer Rial, throws on NaN / ≤ 0. Local `irrToTomanOnce` removed from the catalog.
- `basalamRetailPriceRial(product)`: retail payable from `resolveChannelSale(...,'RETAIL')` (expired sale window → original price, same as storefront).
- Create payload, bulk PATCH items and per-product fallback PATCH send `primary_price` in Rial.
- Products with invalid price are skipped in sync and reported as `invalidPriceSample`.
- `catalogExport.priceToman` unchanged (display only).

## Evidence
- Official Python SDK (`basalam/python-sdk` models): create, `UpdateProductRequestItem`, `UpdateVariantRequestItem`, `UpdateProductVariationSchema` all use `primary_price`; none uses `price` on write.
- Basalam payment API docs state amounts are Rial only. Product API docs do not state the unit explicitly (quick-start sample `150000`, SDK sample prints "تومان") → **unit for products is assumed Rial per spec; confirm on one draft product before mass re-sync.**

## Open
- SDK batch endpoint is `PATCH openapi.basalam.com/v1/vendors/{id}/products/batch-updates`; code still calls `core.basalam.com/v3/vendors/{id}/products/bulk` (and `core.../v3/products/{id}` fallback). Not changed here.
- Existing live products created with Toman prices need a re-sync — Hamed decision (out of scope).
