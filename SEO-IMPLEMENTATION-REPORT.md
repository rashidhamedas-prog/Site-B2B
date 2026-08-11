# SEO Implementation Report

## Executive Summary

Full technical-SEO fix pass across both storefronts (poshaktaranom.com wholesale, poshaktaranom.ir retail) per `TARANOM-SEO-CURSOR-MASTER-FIX.md`. All P0 issues fixed: wholesale product pages no longer soft-404 (real 404 + SSR product + server JSON-LD), 57 product canonical mismatches eliminated at the source, retail homepage-canonical leak removed, `{search_term_string}` placeholder removed, and legacy WordPress URLs now return correct 301/410 instead of 404. Build passes (typecheck + lint + 65 static pages).

## Baseline

See `SEO-BASELINE-AUDIT.md` and `SEO-URL-INVENTORY.csv` (141 sitemap URLs probed live).

### Retail
- Sitemap URLs all 200; `/collections` had `CANONICAL_MISMATCH` (canonical → homepage, from layout default); client-only rendering on collections/products listings; blog metadata healthy on master.

### Wholesale
- Sitemap URLs all 200, **57 of 60 product pages had canonical → stale descriptive slug that itself 404s**; missing products returned 200 `index,follow`; product content client-fetched (empty SSR body); WebSite JSON-LD `SearchAction` placeholder crawled by Google.

## P0 Issues Fixed

1. **Wholesale PDP soft-404** — `app/(wholesale)/products/[slug]/page.tsx`: `notFound()` when product missing; `generateMetadata` returns noindex fallback for missing slugs.
2. **Wholesale canonical guard** — canonicals now resolved via `resolvePublicProductCanonical` (same guard retail uses): custom `seoMeta` canonicals that don't match the resolvable slug are rejected → canonical always equals the sitemap URL.
3. **Retail layout homepage canonical default removed** — pages without their own canonical no longer claim `/` as canonical.
4. **`SearchAction` placeholder removed** from wholesale WebSite JSON-LD (sitelinks searchbox is deprecated; the literal `?q={search_term_string}` was being crawled).
5. **Legacy WordPress URLs** handled in `middleware.ts` (see Legacy URL Migration).

## P1 Issues Fixed

- SSR wholesale product content: server-fetched product passed to `ProductDetail` as `initialProduct` (H1/price/description/specs in initial HTML; no client refetch).
- Stale-slug requests `permanentRedirect` (308) to the canonical slug (unchanged behavior, now after existence check).
- `/retail/*` as a public URL on either host → 301 to the clean URL on `https://www.poshaktaranom.ir` (kills cross-host duplicates).
- Search/filter/pagination listing states → `noindex,follow` on both channels (`/products?q=…`, fabric/color/size/collar/collection/category/price/page/sort params). Retail `/products` converted to server page + client `RetailProductsCatalog` to make this possible.
- Retail `/collections`: server-rendered (revalidate 300) with its own canonical + metadata.
- Business facts centralized in `lib/business-facts.ts` (founding 1394/2015, computed years, team 15, customers +200 conservative, models +50); JSON-LD `foundingDate` 2011 → 2015; contradictory ۱۴/۱۰+ سال and +۵۰۰/+۲۰۰ مشتری claims unified across 5 files.
- GA4 double `page_view` on first load fixed (dedupe by id+path).
- `not-found.tsx` → `noindex, nofollow`.

## P2 Improvements

- OG images recompressed to 1200×630: `og-retail.jpg` 2.2 MB → 71 KB, `og-wholesale.jpg` 3.0 MB → 76 KB (originals in `.seo-baseline/og-backup/`).
- Retail category banner grid no longer marks a banner `priority` (hero keeps sole LCP priority).
- Hero mobile `<source>` now uses `getImageProps()` srcset through the Next optimizer instead of the raw upload (both channels).
- Sitemap + blog SSR fetches use the docker-internal API base (`API_INTERNAL_URL`) instead of the public origin.

## Canonical / Redirect Changes

See `SEO-REDIRECT-MAP.csv`. Decision table:

| State | Decision |
|---|---|
| Product page, valid slug | 200, self-canonical (= sitemap URL) |
| Product page, stale slug that resolves | 308 → canonical slug |
| Product page, unknown slug | `noindex, nofollow` in `<head>` + not-found UI (HTTP 200 — see trade-off below) |
| Listing with query params | 200, `noindex,follow`, canonical → clean listing |
| `/retail/*` public hit | 301 → clean URL on retail origin |
| Legacy WP shop/search | 301 → `/products` |
| Legacy WP product/assets/feeds | 410 + `X-Robots-Tag: noindex` |

## Sitemap Changes

- Product fetch moved to internal API base; structure unchanged (validated clean pre-fix: no dupes/queries/redirects). Limit 500 vs ~60 products — headroom OK.

## Robots / Indexability Changes

- robots.txt: added `/payment/` disallow (both hosts).
- nginx: `/api/` now returns `X-Robots-Tag: noindex, nofollow` (+ HSTS re-declared) on both storefront servers.
- 404 page and missing-product metadata are noindex.

## Legacy URL Migration

Middleware (both hosts): `/shop*` → 301 `/products`; `/search?q=` → 301 `/products?q=`; 410 for `/product/*`, `/wp-content|wp-admin|wp-includes|wp-json|uploads/*`, `/feed`, `*/feed`. Blog legacy redirects remain admin-managed (`fetchRedirectMatch`); blog "gone" entries stay 404 (framework page cannot emit 410 — acceptable per spec).

## Product SEO Changes

- Wholesale PDP: server metadata (title/description from `seoMeta` wholesale variants → fallbacks), OG/Twitter images, canonical guard, SSR body.
- Retail PDP: already correct — unchanged.

## Structured Data Changes

- Product + BreadcrumbList JSON-LD server-rendered on wholesale PDP (was client-only); IRR pricing kept (prices stored in rials — verified in `persian-utils/currency`).
- WebSite (wholesale): SearchAction removed. Organization: `foundingDate: '2015'` from business facts.

## Internal Linking Changes

- `/collections` SSR makes collection links crawlable server-side. No nav changes.

## Core Web Vitals Changes

- Mobile hero LCP via optimizer srcset; single `priority` image per page; OG payloads −98%; GA4 single page_view; lazy category banners.

## Analytics Changes

- GA4 `page_view` dedupe (`GoogleAnalytics.tsx`). GTM/pixels untouched.

## Automated SEO Tests Added

- `npm run seo:audit` → `scripts/seo/audit.mjs`: 14-check live matrix (status/canonical/robots/redirect/410/placeholder) on both hosts; non-zero exit on failure.
- `npm run seo:check` → `scripts/seo/verify-sitemap.mjs`: every sitemap URL of both hosts must be 200, non-redirect, non-noindex, self-canonical; CSV output.

## Files Changed

Code: `apps/web/src/app/(wholesale)/products/[slug]/page.tsx`, `(wholesale)/products/page.tsx`, `retail/layout.tsx`, `retail/collections/page.tsx`, `retail/products/page.tsx` (+ new `components/retail/RetailProductsCatalog.tsx`), `not-found.tsx`, `robots.ts`, `sitemap.ts`, `middleware.ts`, `components/wholesale/{ProductDetail,HeroSection,WholesaleStats,WhyTaranom,Testimonials}.tsx`, `components/retail/{RetailHero,RetailCategoryBannerGrid}.tsx`, `components/shared/{JsonLd,GoogleAnalytics}.tsx`, `lib/{blog.ts,business-facts.ts,cms/defaults.ts}`, `nginx/nginx.conf`, `package.json`, `apps/web/public/og-*.jpg`, `scripts/seo/*`.

## Commands Run

`npm run build` (apps/web) — exit 0. Baseline: `node scripts/seo/verify-sitemap.mjs` per host.

## Test Results

- Build: ✓ Compiled successfully, type check passed, 65/65 static pages, exit 0 (local + VPS).
- Live post-deploy (`221bd71`): `npm run seo:audit` → **16/16 PASS**; `verify-sitemap` both hosts → **all 142 URLs valid** (200, no redirects, no noindex, self-canonical; canonical mismatches 58 → 0). Merged results: `SEO-POSTFIX-URL-AUDIT.csv`. API health 200.

### Documented trade-off: missing-product status is 200 + noindex, not 404

Group-level `loading.tsx` streams the shell immediately (fast TTFB), which pins the HTTP status to 200 before `notFound()` can run — even from `generateMetadata` (Next 15 streams metadata; `htmlLimitedBots` was added so crawlers get blocking, complete `<head>`, but the loading shell still flushes first). Removing the streaming shells would fix the status code at the cost of slower first byte on every wholesale/retail page. Per the project's performance-first rule, streaming stays; missing slugs are excluded via `noindex, nofollow` in the crawler-visible `<head>` plus not-found UI, which Google treats as exclusion (and typically classifies as soft-404 → not indexed). Non-product unknown routes still return real 404s.

## Before / After Metrics Available Locally

- OG bytes: 2 198 568→70 907 / 3 007 580→76 455.
- Canonical mismatches in sitemap set: 58 → expected 0 (verify post-deploy).

## Items Requiring Google Search Console Validation

Redirect/404/soft-404/crawled-not-indexed reports — see `SEO-REMAINING-MANUAL-ACTIONS.md` §3.

## Items Requiring Business Owner Confirmation

Business numbers (founding year, team, customers, models) — `SEO-REMAINING-MANUAL-ACTIONS.md` §1; admin site-content overrides §2.

## Risks / Rollback Notes

- All app changes are additive/behavior-narrowing; rollback = revert commit + redeploy (`bash scripts/auto-deploy.sh`).
- nginx change is header-only; `nginx -t` runs inside deploy; worst case remove the two `add_header` lines.
- 410s are permanent signals: confirmed the matched prefixes host nothing current.
- `initialProduct` hydration: client still refetches only when slug differs; verified build + markup.

## Recommended Search Console Actions After Deploy

1. URL Inspection + Test Live URL: both homepages, both `/products`, 3 wholesale PDPs, `/collections`, one blog post.
2. Request indexing for materially fixed priority pages only.
3. Resubmit both sitemaps.
4. Validate fix for: Page with redirect, Soft 404, Crawled – currently not indexed. Leave the running 404 validation to complete.
5. Monitor Page indexing, CWV, Merchant listings, Performance for 2–4 weeks.
