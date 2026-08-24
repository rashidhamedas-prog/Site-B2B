# PHASE 03B — DISCOVERY SOURCES
Date: 2026-08-24
Live HTML crawl (PHASE-03A, 1027 links) found **0** public hrefs to these GSC 404s.

## Malformed Persian-concatenated URLs

Exact GSC paths equal `RetailFooter` `COLS[].href + COLS[].label`:

| GSC path | Footer href | Footer label |
|---|---|---|
| `/productsجدیدترین‌ها` | `/products` | جدیدترین‌ها |
| `/contactتماس` | `/contact` | تماس |
| `/shippingارسال` | `/shipping` | ارسال |
| `/collectionsکلکسیون‌ها` | `/collections` | کلکسیون‌ها |
| `/productsمانتو` | `/products` | مانتو |

Live homepage hrefs for those labels are the **href** column (correct). The React list `key={l.href + l.label}` emitted those strings into the client bundle, which is a plausible Google discovery source.

Fix: keys are now `${col.title}-${index}`. No 301 (accidental garbage).

`/&` and `/$`: no matching href in source. Home HTML substring hits were false positives (`&` / `$` in other tokens). Retain 404.

## Fonts / manifest / `/_next/image`

- `/fonts/Vazirmatn-*.woff2` — `apps/web/src/app/layout.tsx` preload. HTTP 200. Not landing pages.
- `/manifest.json` — same layout `rel="manifest"`. HTTP 200 JSON.
- Six `/_next/image?...poshaktaranom.com/media/products/...` — live home still contains 39 `poshaktaranom.com/media` product URLs. `next.config.ts` allowlists that host. PHASE-02B only took **Hero** off `/_next/image`; product images still use shared `.com` media by architecture. No rewrite.

## Historic `/_next/static/media/*.p.woff2`

Four hashes are **absent** from current source. Current fonts are `/fonts/Vazirmatn-*.woff2`. Stale Next build hashes. Do not redirect hashed assets.

## API

`/api/` and `/api/shop/product/catalog/` — nginx proxies `/api/` to Nest; Woo-style path 404 JSON + `x-robots-tag: noindex, nofollow`. `robots.txt` Disallow `/api/`. No HTML hrefs in repo/live crawl.

## Feeds

- `/blog/feed/` live **410** (middleware). Current RSS: `/blog/feed.xml` 200.
- `/blog/31-معرفی/feed/` live **410**. WP category feed; not equivalent to the site RSS. Keep 410.

## Account / uploads

- `/account` — `robots.ts` Disallow + `retail/account/layout.tsx` `noindex,nofollow`. Private. GSC robots block is expected.
- `/uploads/` — GSC 403; live **410** from middleware `GONE_PREFIXES`. Directory listing not enabled. Media is `/media/`.

## Legacy products / categories

Catalog export `SEO-AUDIT-PACKAGE-POSHAKTARANOM-IR/12-EXPORTS/products-seo-export.csv`: **ماهین** exists (`maserati-pants-mahin`). **ترگل / ساغر / سهند / id 59** do not.

Category `women-pants` is the current شلوار URL (`categories-seo-export.csv`). WP `/category/20/شلوار/` carries that name. `/category/17/کت-کتان/` is ambiguous. `/category/10` has no name.

## Not found in sitemap

All exact GSC URLs: `in_sitemap=no` (77 loc retail sitemap).
