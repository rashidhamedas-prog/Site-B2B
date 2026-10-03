# SEO/GEO Decision Report — poshaktaranom — 2026-10-03

## Executive outcome

سینک موجودی ERP→سایت با `productSku = products.code` کار می‌کند. برای ۲۲ کالای با تطابق نام یکتا، SKU سایت همان کد ERP می‌شود تا `findBySku` مستقیم بگیرد. URL ویترین (`slug`) عوض نمی‌شود؛ کدهای بازاریابی قبلی alias می‌مانند.

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
| A | alias table + SKU align 22 pairs | findBySku(erp) + slug unchanged |
| B | skip ambiguous | no dual SKU unique clash |
| C | clear inventory idempotency | no 24h cached miss |

## QA & release decision

GO after migrate + align SQL + health 200 + sample PDP slug still 200.

## Measurement and next review

After ERP full-sync: unmatched `product_sku_not_found` should drop for the 22. Remaining ERP codes need manual map.
