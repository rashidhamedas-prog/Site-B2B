# PHASE-02B IMPLEMENTATION

Project: `poshaktaranom.ir` (retail)  
Date: 2026-08-23  
Branch: `ai/TASK-20260822-004-retail-pdp` @ `1f9d9bf`  
Deploy: **not run**

Phase 01 dirty files were read and patched merge-safe. Product/blog/category content, slugs, canonicals, sitemap, and middleware dual-host routing were not changed.

---

## PATCH A — SSR CMS → internal API

**File:** `apps/web/src/lib/cms/fetch.ts`  
`fetchSiteContent` now uses `getServerApiBase()` (`API_INTERNAL_URL` → docker `http://api:4000/v1`).  
Client chrome (`useSiteChrome.ts`) still uses the public/same-origin URL.

`getServerApiBase()` moved to `apps/web/src/lib/server-api-base.ts` so Client Components that import CMS prop helpers do not pull React `cache()`. Production fallback is `http://api:4000/v1`, not localhost.

---

## PATCH B — Duplicate `/settings/public`

**Before (Home render, code paths):**

1. Root `generateMetadata` → `resolveGscVerification()` → `headers()` + public-origin settings fetch  
2. Root layout → same again  
3. Retail `generateMetadata` → `resolveGscVerification('RETAIL')`  
4. Retail layout → `GET /settings/public?channel=RETAIL`

**After:**

- Root does not call `headers()`. GSC meta tags come from `resolveGscTokensForRootHead()` (env first; otherwise one cached fetch per missing channel).  
- Retail layout + GSC fallback share `fetchPublicSettings('RETAIL')` (`React cache()` + `revalidate: 120`).  
If GSC env tokens exist: **0 extra settings fetches for GSC**; layout still does **1** public-settings fetch for Enamad/marketing.

---

## PATCH C + D + F — Hero preload, LCP, WebP

**Files:** `RetailHero.tsx`, `HeroCarousel.tsx`

Root cause of empty `href=""` preload: `next/image` `fill` + `priority` inside `<picture>` / `getImageProps`.

For local static heroes (`/banners/...webp`): native `<img>` + explicit `<link rel="preload" as="image" href="…">` (desktop + mobile `media`). Does not go through `/_next/image` (no JPEG transcode).

Carousel: `waitForIdle` (requestIdleCallback timeout 4s, fallback 2.5s) before autoplay. Slide 0 stays mounted (hidden when inactive) with high priority. Other slides lazy.

---

## PATCH E — Image optimizer TTL

**File:** `apps/web/next.config.ts`  
`images.minimumCacheTTL`: **86400** (was unset → Next default 60s).

Product uploads use `Date.now()-random` keys (`storage.service.ts`), so a replaced image gets a new URL. Stale optimizer cache is low risk. Hero static files bypass the optimizer.

---

## PATCH G — HTML `no-store` + Home ISR

**Root cause:** `headers()` in `app/layout.tsx` (GTM host + GSC) plus `resolveGscVerification()` without a channel. That dynamized every HTML route.

**Also:** `useSearchParams()` in `GoogleAnalytics` (mounted from retail layout) kept `/retail` dynamic even after `headers()` was removed.

**Fix:**

- Root layout: no `headers()`. GTM host resolved in `DeferredGtm` on the client.  
- `export const revalidate = 60` on root layout and retail home.  
- `export const dynamic = 'force-static'` on `app/retail/page.tsx` only.  
- SPA `page_view` uses `usePathname` + `window.location.search` (no `useSearchParams`).

**Local `next build` after patch:**

```text
○ /retail    148 B    Revalidate 1m
ƒ /retail/checkout
ƒ /retail/account
ƒ /retail/products/[slug]
```

Local `next start` Home headers:

```text
x-nextjs-cache: HIT
x-nextjs-prerender: 1
Cache-Control: s-maxage=60, stale-while-revalidate=31535940
```

PDP remains uncached (`fetchProductBySlug` `cache: 'no-store'`). Cart/checkout/account stay `ƒ`.

---

## PATCH H — Catalog HTML

- SSR seed still 24 products, slimmed via `slimRetailCatalogProduct` (card fields only).  
- `?page=` is SSR’d (not treated as a client-only filter).  
- Crawlable prev/next `<Link href="/products?page=N">` added.  
- Default listing `revalidate = 120`; filter query strings stay dynamic (`searchParams`).

Local catalog HTML size is **not** comparable to production (build-time API had no catalog rows).

---

## PATCH I — Homepage image storm

- Product cards: explicit `loading="lazy"`, tighter `sizes`.  
- Compact (home) cards skip hover second image.  
- Category banners already lazy. Only first hero is eager.

---

## PATCH J — GTM / gtag duplicate loader

Removed direct `gtag/js?id=G-…` injection from `GoogleAnalytics`.  
`ensureGtagStub()` queues `gtag()` / `dataLayer` until GTM (`GTM-NKBCGQJV`) boots.  
Ecommerce helpers already pushed dataLayer; they now also stub gtag. Blog trackers do the same.  
GTM noscript iframe was removed from root SSR (host unknown without `headers()`). JS GTM still loads after idle.

---

## Not changed

- Middleware dual-host rewrite  
- Public URLs / canonicals / sitemap  
- Product, blog, category content  
- Automatic deploy
