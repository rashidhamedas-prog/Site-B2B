# PHASE 03 — Search Console manual actions

Date: 2026-08-24  
Release: `70638db`  
These steps are **owner-only** in Google Search Console. This deploy did **not** send inspect/index pings.

## Do

1. Inspect the final product URL  
   `https://www.poshaktaranom.ir/products/maserati-pants-mahin`  
   Confirm live 200, self-canonical, indexable. Request indexing **only if** this canonical 200 URL is missing or stale in the index.

2. Inspect the final category URL  
   `https://www.poshaktaranom.ir/category/women-pants`  
   Confirm live 200, self-canonical, indexable. Request indexing only if needed for that canonical 200 URL.

3. Request indexing **only** for final canonical 200 URLs (the two above, plus any other already-200 sitemap URLs you choose). Never for redirect sources.

4. Use **Validate Fix** only for issue groups whose cause was actually corrected in this ship:
   - Page with redirect **chains** on `http://poshaktaranom.ir` (now one hop to www HTTPS)
   - Not found / crawled-not-indexed rows that were **footer concatenated discovery keys** (source hrefs were already correct; keys no longer concatenate `href+label`)
   - The two proven legacy URLs that now 301 to the canonical 200s above

## Do not

- Do **not** request indexing for fonts, `/_next/image`, `manifest.json`, API hosts, `/account`, `/uploads/`, legacy `/blog/.../feed/`, or legitimate 404/410 URLs (ترگل / ساغر / سهند / `/category/17/...` / `/category/10`).
- Do **not** request indexing for `/product/161/شلوار-ماهین` or `/category/20` — those are 301 sources, not canonicals.
- Do **not** mass-validate unrelated 404 groups that were intentionally left gone.

## Notes

`/category/10` is a 200 noindex “category not found” page, not a 301. Do not ask Google to index it.
