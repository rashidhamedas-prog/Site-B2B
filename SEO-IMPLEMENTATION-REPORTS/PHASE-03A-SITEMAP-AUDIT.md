# PHASE 03A — SITEMAP AUDIT
Date: 2026-08-23
Target: `https://www.poshaktaranom.ir`
Method: live GET of `/sitemap.xml` + child sitemaps, then HEAD/GET follow of every `<loc>` (manual redirects).

## Index

| Child | URL | Loc count |
|---|---|---:|
| pages | `/sitemaps/pages.xml` | 8 |
| products | `/sitemaps/products.xml` | 57 |
| categories | `/sitemaps/categories.xml` | 10 |
| blog | `/sitemaps/blog.xml` | 2 |
| **Total unique** | | **77** |

Host on every loc: `https://www.poshaktaranom.ir` (no apex, no http, no query, no `/retail`).

## Validation (all 77)

| Check | Result |
|---|---|
| HTTP 200 | 77/77 |
| Redirect hops | 0 |
| Meta/X-Robots noindex | 0 |
| Wrong host | 0 |
| Duplicate loc | 0 |
| Query-string loc | 0 |
| Self-canonical (or intended canonical) | 77/77 |

Home loc is `https://www.poshaktaranom.ir` (no trailing slash). Live canonical matches.

## Generator

`apps/web/src/lib/sitemap-xml.ts` + `apps/web/src/app/sitemaps/*/route.ts`.

Products: API `status=ACTIVE` then drop `robotsIndex === false` (field often absent → treated as indexable).
Categories: drop `isIndexable === false` or `HIDDEN`.
Blog: published + `robotsIndex !== false`.
`isIndexableLoc` already blocked cart/checkout/login/admin/portal/search/account/payment.

## Safe code change (repo only)

Added `/retail` to `BLOCKED_PATH` so an internal tree loc cannot enter the sitemap if a future generator bug emits it. **No live sitemap loc was `/retail`.** Not deployed.

## Conclusion

No sitemap loc is a known redirect/404/noindex by accident. Do not remove active 200 URLs just because GSC has not indexed them.
