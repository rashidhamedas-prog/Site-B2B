# 2026-10-02 — ERP → Site inventory sync (one-way)

## Status
Technical pipe is **live** on Iran ERP + Site API. Catalog identity is the remaining business blocker.

## What works
- ERP settings: `website_stock_sync_enabled=1`, mode=`push`, target=`site_b2b`
- URL: `https://api.poshaktaranom.com` with Nest path `/v1/erp/inventory/*`
- Auth: ERP token = site `ERP_INVENTORY_API_KEY` (length 64)
- Warehouses: WHOLESALE=35 (کیمیا), RETAIL=34 (محصول)
- Ping HTTP 200 after SSRF lookup fix (Node Happy Eyeballs `lookup({all:true})`)
- Matrix push for both channels when product resolves

## Bugs fixed this session
1. ERP always called `/api/v1/...` on `api.*` hosts → 404 (fixed `siteApiUrl`)
2. `safeRequestJSON` threw `ERR_INVALID_IP_ADDRESS` under Node 20 → ping/push blocked (fixed `pinnedLookup`)
3. Sync was disabled in prod (enabled + dual WH + token)

## Catalog gap (blocker for full stock parity)
| System | SKU style | Example |
|--------|-----------|---------|
| ERP | numeric / K-xxxxx | `7126`, `7200` |
| Site | category prefix | `COATS00012`, `BLOUSES00017` |

- Dry-run of all 36 ERP matrix products → **0** SKU hits on site
- Site `product_variants.barcode`: **0 / 536** filled → barcode auto-resolve cannot help yet
- Same fashion items often exist under different codes (e.g. آرامیس)

## Code added for next step
- Site: `erp_product_map` + resolve order `sku → product_map → barcode`
- Needs migration `20261003-001-erp-product-map` + seed maps (or fill barcodes / align SKUs)

## Suggested ops next
1. Deploy site erp-inventory + run migration
2. Seed `erp_product_map` (ERP code → site productId) for overlapping catalog
3. Optionally sync barcodes from ERP → site variants
4. Re-run ERP `website-full-sync`
