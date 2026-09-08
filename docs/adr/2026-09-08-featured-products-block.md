# ADR: Featured products CMS block

Date: 2026-09-08
Status: Accepted
Task: TASK-20260908-006

## Context

The CMS block type `products` (ادمین: «محصولات برتر») already stored copy, `limit`, `sort`, and a comma-separated `productIds` string. Storefronts did not honor merchandising:

- Wholesale `FeaturedProducts` fetched `GET /products?limit=&status=ACTIVE&channel=WHOLESALE` and ignored `productIds` and `sort`. Renderer also capped `limit` at 8.
- Retail `RetailProductGrid` honored `sort` and `limit` (capped 12) but ignored `productIds`, eyebrow, body, and CTA fields.
- Boutique rail ignored `sort` and `productIds`.
- Admin asked operators to paste UUIDs. No search, no reorder, no channel filter, no empty/disabled state.

`product.isFeatured` is deprecated and aliased to discount. It is not a merchandising flag.

## Decision

Keep one CMS block type and one catalog API. Do not add a featured-products table, page builder, or a second product list endpoint.

### Ownership

| Concern | Owner |
|---|---|
| Copy, source, curated order, filters, portal gate | CMS `site_content.blocks` JSON (`type: products`) |
| Catalog truth (price, stock, channel visibility, ACTIVE) | Product aggregate via `GET /v1/products` |
| Card layout / grid | Channel theme (wholesale / retail classic / boutique) |
| Home card budget | Cap 12 (performance-first) |

### Source modes

- `auto`: catalog query (`sort`, optional `categoryId`, `limit`, optional `inStockOnly`).
- `manual`: ordered UUID list. Storefront asks `ids=` and keeps that order. Missing, inactive, or other-channel rows are dropped. No second fill-fetch (avoids waterfall).

Missing `source` with non-empty `productIds` is treated as `manual` so already-saved IDs start working. Empty IDs stay `auto`.

### Public API

`GET /v1/products` gains `ids` (comma-separated UUIDs, max 16) and `inStock=1`.

- Channel still required for public callers.
- Status stays ACTIVE for storefront.
- `ids` uses `IN (...)` plus merchandising `CASE` order. Pagination is ignored (page 1).
- Invalid tokens are discarded; never interpolated into SQL as raw text.
- Opposite-channel price/stock still stripped by existing `withBadges`.

### Non-goals

- No `isFeatured` merchandising column.
- No in-admin live iframe preview of the home page.
- No layout/column control in CMS (theme-owned).
- No collections filter in this slice.
- No website-builder runtime.

## Consequences

Operators pick models the way they pick related products. Home rails become merchandising, not “whatever the catalog returned first.” Existing JSON without `source` keeps rendering.
