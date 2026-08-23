# PHASE-02B PRODUCTION DEPLOY

Date: 2026-08-23  
Task: TASK-20260823-001

## Identifiers

| Field | Value |
|-------|--------|
| Release commit | `13bf65788052cf1cd5549a2d9aeeeb05c589b895` |
| Release short | `13bf657` |
| Rollback target | `6796362df51040ccfa591c02a1831320386b1cfa` (`6796362`, PR #52 live before this ship) |
| Deploy method | Existing `scripts/auto-deploy.sh` on VPS `/opt/taranom` (git fetch/reset origin/master, `docker compose build api web`, `up -d`, existing schema safety-net SQL, API health) |
| Deploy start | 2026-08-23T14:25:09Z |
| Deploy end | 2026-08-23T14:34:41Z |
| Deploy status | **SUCCESS** |
| Prisma `migrate deploy` | **NOT RUN** — no Prisma schema; stack is TypeORM; PHASE-02B forbids new migrations |

## Internal API preflight (web container)

`API_INTERNAL_URL=http://api:4000/v1`

| Probe | Result |
|-------|--------|
| `/health` | HTTP 200, 55 B |
| `/settings/public?channel=RETAIL` | HTTP 200, 6651 B, retail business payload |
| `/cms/site-content/RETAIL/home` | HTTP 200, 1934 B, RETAIL home + hero blocks |
| `/products?channel=RETAIL&limit=8&status=ACTIVE` | HTTP 200, 100895 B, live products |

Post-deploy probes (same container, new web): health 200 / settings 200 / CMS 200 / products 200.

**Internal API preflight: PASS**

Public build-arg `NEXT_PUBLIC_API_URL` host `poshaktaranom.com` path `/api/v1` also returned live CMS/products (used during `next build` inside Docker).

## Storefront smoke

| Check | Result |
|-------|--------|
| Home real data | **PASS** — HTTP 200, 443 KB HTML, 12 `/products/{slug}` links, live CMS hero (e.g. بهگل), category tiles, priced product cards |
| Catalog real data | **PASS** |
| Catalog product link count | **24** unique `/products/{slug}` in `/products` HTML |
| Category `/category/shomiz` | **PASS** — HTTP 200, 16 product links, canonical `https://www.poshaktaranom.ir/category/shomiz` |
| PDP `linen-shirt-manteau-golrokh` | **PASS** — HTTP 200, ~266 KB (not the old 34 KB 404 shell), title/description/JSON-LD, size guide, mobile buy bar |
| Cart | Route `/cart` is **404** with `no-store` (cart is header drawer, not a page). No public cache. |
| Checkout | **PASS** — HTTP 200, `private, no-store` |
| Account | **PASS** — HTTP 200, `private, no-store` |

## Home cache / ISR

| Request | `x-nextjs-cache` | `Cache-Control` | TTFB |
|---------|------------------|-----------------|-----:|
| 1 | STALE | `s-maxage=60, stale-while-revalidate=31535940` | 1162 ms |
| 2 | HIT | same | 620 ms |
| 3 | HIT | same | 733 ms |

Also `x-nextjs-prerender: 1`. Catalog remains dynamic `no-store` (searchParams). PDP `no-store`.

**Home ISR/cache: PASS**

## GA4 single loader

- SSR: `GTM-NKBCGQJV` present; `GTM-PKHBQ74Z` absent; no app-injected `gtag/js?id=G-F2V7VSJMLE`
- Runtime (browser): `gtm.js?id=GTM-NKBCGQJV` loaded; GA4 destination script appears only as GTM child (`gtag/js?id=G-F2V7VSJMLE&cx=c&gtm=…`)
- `dataLayer` included `gtm.js`, `page_view`, `gtm.dom`, `gtm.load`

**GA4 single-loader: PASS**

## Ecommerce smoke

Unit spec `retail-analytics.spec.ts` **PASS**. Live `page_view` in dataLayer **PASS**. Click-path `view_item` / `add_to_cart` / `begin_checkout` not exercised as a real purchase (spec: purchase not required).

**Analytics smoke: PASS** (page_view + unit helpers; no live purchase)

## SEO regression

| Check | Result |
|-------|--------|
| Canonical host | `https://www.poshaktaranom.ir` (home without `/retail`) |
| `/retail` in canonical | none on sampled pages |
| robots.txt | 200 |
| sitemap.xml | 200 index (pages/products/categories/blog) |
| Fake URL | 404 |
| Product JSON-LD | present (10 script types on PDP) |
| Blog JSON-LD | present |

**SEO regression: PASS**

## Production TTFB (curl `time_starttransfer`, 3 samples, median)

| URL | Old median | New cold/first | New warm median | Status |
|-----|----------:|---------------:|----------------:|--------|
| Home `/` | 1009 ms | 1162 ms | **677 ms** (HIT pair 620 / 733) | improved vs 1009; 3-sample median 733 ms |
| Catalog `/products` | 731 ms | 714 ms | **714 ms** | slightly improved; still dynamic |
| Category `/category/shomiz` | 670 ms | 678 ms | **678 ms** | ~flat |
| PDP golrokh | 650 ms | 673 ms | **693 ms** | ~flat / slightly slower (intentionally uncached) |
| Blog article | 603 ms | 681 ms | **681 ms** | slightly slower |

Do not compare local 9–27 ms to these numbers.

## Hero / LCP

- Empty `href=""` image preload: **gone**
- First hero static WebP preloads: `/banners/hero-product-2026-v2/retail-01.webp` (min-width 768) and `retail-01-mobile.webp` (max-width 767), `fetchPriority=high`
- Hero `<img>` uses those URLs, not `/_next/image`
- Extra enamad seal preload still present (pre-existing third-party)
- **LCP_NOT_AVAILABLE** as a lab field in this session (no CrUX export); browser screenshot showed live CMS hero

## Rollback required

**NO**

## Remaining

- `/cart` is not a document route (drawer). Cache-safe 404.
- GTM loads `gtag.js` for `G-F2V7VSJMLE` as a **GTM-injected** destination (`cx=c&gtm=`), not a second app loader.
- Catalog HTML is dynamic `no-store` (not ISR) because of `searchParams`.
- Auto-deploy still runs idempotent `apply-production-schema.sql` (columns already existed; no Prisma).
