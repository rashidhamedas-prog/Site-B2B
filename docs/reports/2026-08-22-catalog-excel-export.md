# 2026-08-22 — خروجی اکسل محصولات و دسته‌بندی‌ها

## Scope

Admin-only `.xlsx` download for catalog products and categories, with wholesale / retail / all filters.

## Endpoints

- `GET /v1/products/admin/export.xlsx?channel=WHOLESALE|RETAIL|ALL` (JWT ADMIN)
- `GET /v1/categories/admin/export.xlsx?channel=WHOLESALE|RETAIL|ALL` (JWT ADMIN)

## Workbook contents

Products: identity, dual-channel visibility, Toman prices (final + compare-at), discount window, stock, pack MOQ, specs, SEO, public URLs, related SKUs; second sheet for color/size variants.

Categories: dual-channel SEO fields, SKU prefix, product counts for the selected channel, public `/category/{slug}` URLs on `.com` and `.ir`.

## Notes

- No new npm dependency. OOXML is built with a stored ZIP writer.
- Prices are تومان (DB stores IRR = Toman × 10).
- Unauthenticated requests are rejected by existing admin JWT + RolesGuard.
