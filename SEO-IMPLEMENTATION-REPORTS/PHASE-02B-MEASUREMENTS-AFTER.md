# PHASE-02B MEASUREMENTS AFTER

Date: 2026-08-23  
Production: **not deployed** — live TTFB is unchanged.  
Local: `next start` on `127.0.0.1:3010` with `Host: www.poshaktaranom.ir` after `next build`.

Production before numbers are this session’s PHASE-02B baseline (curl median).

---

## TTFB table

| URL | TTFB Before (prod median) | TTFB After Cold | TTFB After Warm | Size Before | Size After |
|---|---:|---:|---:|---:|---:|
| Home `/` | 1009 ms | **NOT_DEPLOYED** (prod). Local first: **27 ms** | Local HIT: **9–17 ms** | 466,176 B | Prod unchanged. Local prerender 66,220 B (CMS fallback at build; not a production payload) |
| Catalog `/products` | 731 ms | **NOT_DEPLOYED** | **NOT_DEPLOYED** | 723,422 B | Slimmer SSR objects in code. Local 31,435 B with **0 product links** (no API at prerender) — do not treat as production-after |
| Category `/category/shomiz` | 670 ms | **NOT_DEPLOYED** | **NOT_DEPLOYED** | 156,905 B | unchanged in prod |
| PDP `linen-shirt-manteau-golrokh` | 650 ms (old slug `golrokh-linen-shirt-dress` was a 34 KB streamed 200) | **NOT_DEPLOYED** (intentionally uncached) | — | 34,084 B (old slug shell) | — |
| Blog `trendy-womens-shirt-1405` | 603 ms | **NOT_DEPLOYED** | **NOT_DEPLOYED** | 78,158 B | — |

Local Home Cache-Control after patch:

```text
x-nextjs-cache: HIT
x-nextjs-prerender: 1
Cache-Control: s-maxage=60, stale-while-revalidate=31535940
```

Production Home is still:

```text
Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate
```

until deploy.

---

## Home extra (local prerender HTML)

| Check | Result |
|-------|--------|
| empty preload `href=""` | **NO** |
| hero priority / preload | **YES** — 2 valid `/banners/…webp` preloads (mobile + desktop) |
| hero content-type path | direct static WebP, not `/_next/image` |
| hero optimizer cache | N/A locally (optimizer bypassed for LCP) |
| number of eager / high-priority | 1 hero `<img fetchPriority=high>` + 2 preload links |
| number of total `<img>` | 1 in this prerender (product grid missing: API empty at build) |
| direct `gtag/js` in HTML | **NO** |
| GTM in SSR HTML | **NO** (idle `DeferredGtm` client inject) |

---

## Browser (Cursor)

Production after-patch navigation was **not** available (no deploy).  
Local retail HTML requires `Host: www.poshaktaranom.ir`; the Cursor browser cannot set that Host header, so in-tab local `/` is wholesale.

| Field | Value |
|-------|--------|
| document TTFB | LOCAL_CURL 9–27 ms (not browser Navigation Timing) |
| DOMContentLoaded | **NOT_MEASURED** |
| load | **NOT_MEASURED** |
| hero request | static `/banners/hero-product-2026-v2/retail-01.webp` (preload present) |
| LCP | **LCP_NOT_AVAILABLE** |
