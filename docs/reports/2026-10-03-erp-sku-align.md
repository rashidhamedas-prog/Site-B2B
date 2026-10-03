# SEO/GEO Decision Report — poshaktaranom — 2026-10-03

## Executive outcome

سینک موجودی ERP→سایت با `productSku = products.code` کار می‌کند. برای ۳۰ کالای قابل‌تطبیق، SKU و نام سایت همان ERP می‌شود تا `findBySku` مستقیم بگیرد. URL ویترین (`slug`) عوض نمی‌شود؛ کدهای بازاریابی قبلی alias می‌مانند. بارکد واریانت در صورت تطابق رنگ×سایز کپی می‌شود.

## Scope & evidence

- Markets: fa-IR wholesale `.com` + retail `.ir`
- Templates: PDP `/products/{slug}`, admin SKU field, ERP matrix PUT
- Access: catalog dumps 2026-10-03 (`docs/reports/2026-10-03-erp-site-sku-diff.md` در ERP)
- Slack: هیچ پیام مرتبطی پیدا نشد
- Official: Google canonical/slug vs SKU — سیاست داخلی؛ SKU هویت URL نیست

## Baseline

| KPI | definition | period | value | source | limitation |
|---|---|---|---|---|---|
| Exact SKU overlap | ERP matrix code = site sku | 2026-10-03 | 0 / 36 | ERP compare report | matrix products only |
| Mapped | erp_product_map | 2026-10-03 | 4 | name_seed | barcodes empty |

## Findings

| ID | P | type | scope | evidence | cause |
|---|---|---|---|---|---|
| SKU-1 | P0 | Evidence | matrix catalog | 0 exact SKU hits | marketing SKU vs ERP code |
| SKU-2 | P1 | Evidence | 14 ERP rows | ambiguous names | two site products / wrong token |

## Delivery backlog

| ID | change | acceptance |
|---|---|---|
| A | alias table + SKU/name align 30 pairs | findBySku(erp) + slug unchanged |
| B | skip missing / wrong-identity catalog | no invented products; no یاسمین→آفاق / یلدا→بارونی |
| C | clear inventory idempotency | no 24h cached miss |
| D | variant barcode copy when color×size match | barcodes fill without changing slug |

## QA & release decision

GO after migrate + align SQL + health 200 + sample PDP slug still 200.

## Measurement and next review

Live VPS: 30 SKUs + names aligned (7147 via `BLOUSES00001` / slug `linen-shirt-manteau-nazgol`). Variant barcodes did not copy because site color labels differ; ERP matrix color×size remains the stock path.

After ERP full-sync: unmatched `product_sku_not_found` should drop for the 30 aligned codes.

ERP codes without a unique site row (do not invent): `7063`, `7127`, `7129`, `7168`, `7200`, `K-00227`.
