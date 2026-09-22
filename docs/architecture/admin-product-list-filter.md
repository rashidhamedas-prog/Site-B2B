# Admin product list filter

Confirmed 2026-09-22. The operator filter lives on `/admin/products`, not `/admin/settings`.

## Facts

- Settings is the shop document (identity, shipping, payment, SEO). The catalog workspace already owns the product list.
- `GET /v1/products/admin` already accepted `categoryId`, `collectionId`, `status`, and `inStock`. The admin UI only sent channel and search.
- A product matches a category when `products.categoryId` is that id **or** a `product_category_membership` row exists. Primary category stays the SKU source.
- Categories are a flat list. There is no parent tree.

## Decisions

1. URL is the source of truth: `categoryId`, `status`, `collectionId`, `inStock`, plus existing `channel`, `q`, and `section`.
2. `categoryId=uncategorized` means no primary category and no membership row. Any other non-UUID is rejected with 400 and is not interpolated into SQL.
3. In-stock follows the selected channel. With channel `ALL`, either retail or wholesale stock above zero counts.
4. Excel export stays channel-only.
5. No schema change and no storefront filter-rail change.

## Non-goals

- Configuring which facets the public catalog shows
- Multi-category OR in one request
- Grouping the table into category sections
