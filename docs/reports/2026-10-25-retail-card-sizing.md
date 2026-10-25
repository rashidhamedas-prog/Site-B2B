# Retail card sizing — false «فری سایز» on `/products`

**Date:** 2026-10-25  
**Branch:** `fix/retail-card-sizing`  
**Deploy:** gated — no merge to `master` without explicit approval

## Problem

Live API (`/api/v1/products?channel=retail`) returns mixed `sizeType` (TWO/THREE/FREE), but SSR HTML for `/products` showed ~25 «فری سایز» chips and no `sizeType` in the payload.

## Root cause

1. `slimRetailCatalogProduct` omitted `sizeType` / `sizeLabels` / pack fields.
2. `normalizeRetailProduct` omitted the same on catalog seed.
3. `sizesForSizeType` treated missing type as `FREE` → `['فری سایز']`.

Wholesale slim already kept sizing; retail did not.

## Fix

- `pickCatalogSizing` + spread into slim and normalize.
- `sizesForSizeType`: missing/invalid → `[]` (pack/admin pass `?? 'FREE'` explicitly).
- Card chips via `storefrontSizeChips` + `displaySizeLabel` (chart token stays ASCII-space for ERP/DB match).
- Shared `SIZE_TYPE_SUMMARY` with catalog filters.

## Evidence

| Check | Result |
| --- | --- |
| Live API sizeType (n=30) | TWO 15 / FREE 11 / THREE 4 |
| Live HTML «فری سایز» before fix | ~25 |
| ACTIVE products with null/empty sizeType (Iran) | **0** — no backfill |
| Unit specs | `product-display`, `catalog-filter`, `slim-retail-catalog` OK |
| `apps/web` type-check | OK |

## Rollback

`git revert` of the merge commit on `master` (triggers auto-deploy). Do not change DB values for `'فری سایز'`.
