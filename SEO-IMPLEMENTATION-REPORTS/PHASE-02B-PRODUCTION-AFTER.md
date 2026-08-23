# PHASE-02B PRODUCTION AFTER

Date: 2026-08-23  
Release: `13bf657`  
Rollback target: `6796362`

Production **is** patched. Numbers below are live `www.poshaktaranom.ir` via `curl.exe` `time_starttransfer` from the same Windows workstation used for PHASE-02B baseline. Local 9–27 ms figures are **not** comparable.

## TTFB table

| URL | TTFB Before (prod median) | TTFB After cold/first | TTFB After warm median | Size Before | Size After | Status |
|---|---:|---:|---:|---:|---:|---|
| Home `/` | 1009 ms | 1162 ms (STALE) | **677 ms** (HIT 620 / 733) | 466176 B | 443514 B | improved warm; ISR HIT |
| Catalog `/products` | 731 ms | 714 ms | **714 ms** (714 / 721 / 673) | 723422 B | 211663 B | slightly faster; HTML much smaller |
| Category `/category/shomiz` | 670 ms | 678 ms | **678 ms** (678 / 665 / 730) | 156905 B | 157480 B | flat |
| PDP `linen-shirt-manteau-golrokh` | 650 ms | 673 ms | **693 ms** (673 / 693 / 702) | 34084 B (old slug shell) | 265294 B | real PDP HTML; uncached |
| Blog `trendy-womens-shirt-1405` | 603 ms | 681 ms | **681 ms** (681 / 702 / 646) | 78158 B | 77924 B | ~flat / slightly slower |

Home 3-sample median (1162, 620, 733) = **733 ms**. Warm HIT-only median = **677 ms**.

## Home extra (production HTML)

| Check | Result |
|-------|--------|
| empty preload `href=""` | **NO** |
| hero priority / preload | **YES** — `retail-01.webp` (min-width 768) and `retail-01-mobile.webp` (max-width 767), `fetchPriority=high` |
| hero content-type path | direct `/banners/hero-product-2026-v2/*.webp`, not `/_next/image` |
| eager / high-priority hero | 1 hero `<img fetchPriority=high>` + matching media preloads |
| product `/products/{slug}` links | **12** on home |
| catalog product links | **24** |
| direct `gtag/js?id=G-F2V7VSJMLE` in SSR | **NO** |
| GTM in SSR | container id `GTM-NKBCGQJV` (script injected after idle) |
| GTM runtime | `gtm.js?id=GTM-NKBCGQJV`; GA4 destination loaded **by GTM** (`cx=c&gtm=`) |
| old `GTM-PKHBQ74Z` | **NO** |
| Home `x-nextjs-cache` | STALE then HIT; `s-maxage=60, stale-while-revalidate=31535940` |
| Checkout/account cache | `private, no-store` |

## Browser

Opened `https://www.poshaktaranom.ir/`. Live CMS hero, category grid, product cards with prices (e.g. کت اسپرت لینن مدل اریکا ۱٬۴۵۰٬۰۰۰ تومان). Cart control is a header button (drawer), not `/cart`. `dataLayer` had `page_view` + GTM load events.

| Field | Value |
|-------|--------|
| document TTFB | curl warm HIT median **677 ms** |
| DOMContentLoaded | **NOT_MEASURED** (no PerformanceObserver export) |
| load | **NOT_MEASURED** |
| hero request | static `/banners/hero-product-2026-v2/retail-01.webp` (+ mobile twin) |
| LCP | **LCP_NOT_AVAILABLE** |

## Rollback

Not used.
