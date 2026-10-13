# Retail home «همه محصولات» — empty slot + incomplete catalog

**Date:** 2026-10-13  
**Surface:** `www.poshaktaranom.ir` home products rail + `/products`

## Root cause

Live CMS block `b_products_all_2026` on `RETAIL/home`:

| Field | Live value | Effect |
|-------|------------|--------|
| `headline` | همه محصولات | Reads as full catalog |
| `source` | `manual` | Only curated UUIDs |
| `productIds` | 12 IDs | Fixed merchandising set |
| `inStockOnly` | `true` | OOS IDs dropped |
| `limit` | 12 (capped) | Never more than 12 on home |

API check: same 12 IDs → **12** without `inStock`; **11** with `inStock=1`. That matches the empty leftmost cell on the incomplete last row (RTL grid).

Catalog has **79** ACTIVE `showOnRetail` products; full list is `/products` (24/page + load more), not the home rail.

## Fix

1. SQL `scripts/fix-retail-home-all-products-block.sql` — `source=auto`, clear IDs/category, `inStockOnly=false`, headline `جدیدترین‌ها`, keep CTA `/products`.
2. UI: rewrite misleading «همه محصولات» headline when catalog is larger than the rail; CTA shows catalog total `(۷۹)`.
3. Admin warning for manual + «همه محصولات» headline.
4. `/products` SSR passes `initialTotal` so the count is correct on first paint.
5. Harden `apply-retail-category-luxury.sql` / `perf-cap-retail-home-products.sql` so they do not reintroduce limit 200 / misleading headline.

## Perf

Home still ≤12 cards (no 79-card home). Extra `limit=1` count fetch only when the rail is manual/curated.

## Verify

- Spec: `apps/web/src/lib/cms/products-block.spec.ts`
- Live: home shows 12 cards, no hole; CTA → `/products` with total; catalog total ≈79
