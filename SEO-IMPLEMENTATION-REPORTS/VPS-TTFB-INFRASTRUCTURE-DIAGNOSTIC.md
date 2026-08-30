# Taranom Infrastructure Performance Diagnostic

Date: 2026-08-30  
Task: TASK-20260830-002  
Spec: `CURSOR-VPS-TTFB-DIAGNOSTIC.md`  
Scope: diagnosis only. No VPS migration, DNS change, or production architecture rewrite.  
`nginx.conf` was not edited (claimed by TASK-20260829-001). Upstream timing was classified with localhost vs loopback vs public curl.

Probe points:

- **Iran workstation** (this session, Windows `curl.exe`): public HTTPS
- **VPS loopback** (`127.0.0.1:3000` / `:4000` / `:443`): app and nginx without Iran path
- Live SHA on `/opt/taranom`: `edebfc5`

Lab Lighthouse / PageSpeed: **NOT_AVAILABLE** this session (PSI HTTP 429). Field CWV: **NOT_AVAILABLE**. Do not mix with curl TTFB.

---

## Executive Summary

The VPS itself is not saturated. On the box, retail home ISR first-byte is **14–28 ms**, nginx loopback is **23–38 ms**, API health is **2 ms**, and a product slug API is **~70 ms**. From Iran, the same retail home is **median 1317 ms TTFB** and a trivial `/api/v1/health` is **median 1553 ms**.

That gap is the Iran → Hetzner Nuremberg path (TLS median **695 ms** on home), not CPU steal, disk, Postgres, or Next.js cold start.

Secondary issues are real and cheaper than a move:

1. Wholesale home is still `Cache-Control: no-store` (on-box ~110 ms vs retail ISR ~14 ms).
2. Category / PDP / blog HTML is dynamic `no-store`.
3. Cloudflare is DNS-only (gray cloud). Origin is `nginx/1.31.2` with no `cf-cache-status`.
4. HTML payloads are large (retail home ~384 KB uncompressed).
5. Noisy neighbors on the same 2 vCPU box (Xray, lead Python, extra Next `seo_auto_web`, Chromium snaps).

**Decision: `OPTIMIZE_CURRENT_VPS_FIRST`.** Shared hosting is **not** recommended. This stack is Docker + Next 15 + Nest + Postgres + Redis + MinIO. Shared PHP hosting cannot run it. Moving the same stack to another VPS without fixing the Iran path will not hit the 500 ms TTFB target.

---

## Current VPS Specifications

| Item | Value | Evidence |
|---|---|---|
| Hostname | `cloudvm-nbg1-3253` | `hostname` |
| Location | Hetzner Nuremberg (nbg1) | hostname + A `5.75.200.102` |
| OS | Ubuntu 24.04.4 LTS (noble) | `lsb_release` |
| Kernel | `6.8.0-138-generic` x86_64 | `uname -a` |
| CPU | Intel Xeon Skylake (IBRS, no TSX), KVM | `lscpu` |
| vCPU | **2** | `lscpu` CPU(s)=2 |
| RAM | **3.7 GiB** total; ~1.4 GiB used; ~2.3 GiB available | `free -h` |
| Swap | 1.0 GiB file, **0 B used** | `swapon` |
| Disk | QEMU virtio, **ROTA=0** (SSD-class), 38.1 G, `/` **77%** (28 G / 8.4 G free) | `lsblk` + `df` |
| Uptime at probe | **47 minutes** (recent reboot) | `uptime` 10:40 UTC |
| Git HEAD | `edebfc5` `fix(web): let retail customers choose ZarinPal or DigiPay` | `/opt/taranom` |

---

## Retail Results

Probe: Iran workstation, n=10, `time_starttransfer`. All sampled URLs HTTP **200**.

### Homepage

`https://www.poshaktaranom.ir/`

| Metric | Value |
|---|---|
| Median TTFB | **1317 ms** |
| P75 | 1412 ms |
| P95 | 1484 ms |
| Max | 1655 ms |
| Total median | 2706 ms |
| DNS median | 22 ms |
| TLS median | **695 ms** |
| Render | **ISR 60s** (`x-nextjs-cache: STALE`, `x-nextjs-prerender: 1`, `s-maxage=60`) |
| HTML | 384309 B uncompressed |
| On-VPS TTFB | **14 ms** median (localhost:3000 Host=www.ir) |
| Nginx loopback | **25 ms** median |
| Public from VPS | **87 ms** median (TLS ~73 ms) |

### Category

`/category/shomiz`

| Metric | Value |
|---|---|
| Median TTFB | **2336 ms** |
| P75 | 2477 ms |
| P95 | 3258 ms |
| Total median | 3806 ms |
| Cache | `private, no-store` (searchParams forces dynamic) |

### Products

| URL | Median | P75 | P95 | Notes |
|---|---:|---:|---:|---|
| `/products/linen-shirt-manteau-golrokh` | 2088 | 2234 | 2828 | `no-store`; fetch `cache: 'no-store'` |
| `/products/coats00015` | 2050 | 2080 | 2161 | same |
| `/products/coats00014` | 2153 | 2986 | 3185 | same |

On-VPS PDP first-byte **33–86 ms**; full download 150–372 ms (HTML size).

### Blog

`/blog/trendy-womens-shirt-1405`

| Metric | Value |
|---|---|
| Median TTFB | **2107 ms** |
| P75 | 2348 ms |
| P95 | 2825 ms |
| Code | `revalidate = 300` declared |
| Live | `no-store` (SSR observed) |

Sitemap median **1681 ms**. Robots median **1667 ms**.

---

## Wholesale Results

### Homepage

`https://poshaktaranom.com/`

| Metric | Value |
|---|---|
| Median TTFB | **2181 ms** |
| P75 | 2820 ms |
| P95 | 4486 ms |
| Max | 5215 ms |
| Total median | 4314 ms |
| Cache | **`no-store`** — no `force-static`, no prerender header |
| On-VPS TTFB | first 527 ms, then **~110 ms** warm |

### Category

`/category/shomiz` — median **2283 ms**, p75 2308, p95 3164.

### Products

| URL | Median | P75 | P95 |
|---|---:|---:|---:|
| `/products/linen-shirt-manteau-golrokh` | 1970 | 2223 | 2270 |
| `/products/coats00015` | 2186 | 2309 | 3140 |
| `/products/coats00014` | 2126 | 2236 | 2364 |

### Blog

`/blog/wholesale-summer-manto-restock-1405` — median **2629 ms**, p75 2883, p95 3022.

Sitemap median **1662 ms**. Robots median **1535 ms**.

---

## CPU & RAM

| Check | Result | Severity |
|---|---|---|
| Load average | 0.31 / 0.24 / 0.27 (2 vCPU) | OK |
| CPU idle | 89–96% in `vmstat` | OK |
| CPU steal | **0.00%** every sample | OK — not oversold |
| RAM pressure | 2.3 GiB available of 3.7 | OK now |
| Swap | unused | OK |
| Hottest process | `next-server` 6.8% CPU, 390 MB RSS | Expected |
| API | `node dist/main` 120–137 MB | OK |
| Neighbors | Xray ~40 MB / 1.8% CPU; lead uvicorn ~102 MB; `seo_auto_web` 120 MB / 768 MB cap; Chromium snaps | P3 capacity risk |

No CPU or RAM bottleneck at idle/test load. A 2 vCPU / 3.7 GiB box will saturate if image optimizer + crawlers + Xray spike together. That is capacity planning, not today’s TTFB cause.

---

## Disk I/O

| Check | Result |
|---|---|
| Device | `sda` QEMU, non-rotational |
| `%util` | 0.0–1.2% |
| `r_await` | 0.33 ms average |
| `w_await` | 0.5–1.5 ms |
| Sequential write 128 MiB `dd` `fdatasync` | **526 MB/s** |
| iowait | 0–0.5% |

**Disk is not the bottleneck.** No 512 MiB test was run (128 MiB already proved SSD-class latency).

---

## Network

DNS (from Iran workstation):

| Name | Type | Value | TTL |
|---|---|---|---|
| `poshaktaranom.ir` | A | `5.75.200.102` | 300 |
| `www.poshaktaranom.ir` | A | `5.75.200.102` | 149 |
| `poshaktaranom.com` | A | `5.75.200.102` | 300 |
| both zones | NS | `finley` / `connie`.ns.cloudflare.com | 21600 |

AAAA: not observed on these A lookups. Provider: Cloudflare DNS, **origin exposed** (not proxied).

Path evidence:

```text
Iran public health API median TTFB = 1553 ms
VPS localhost health TTFB         = 2 ms
Iran public retail home           = 1317 ms
VPS localhost retail home         = 14 ms
VPS public HTTPS home             = 87 ms
Iran TLS handshake median         = 695 ms
```

**Primary TTFB for Iranian users is the Iran ↔ Nuremberg RTT + TLS**, not application time.

---

## Nginx

Running in `taranom_nginx` (`nginx:alpine` 1.31.2), not host systemd nginx.

| Feature | Status |
|---|---|
| gzip | ENABLED |
| brotli | NOT_APPLICABLE (not compiled/configured) |
| HTTP/2 | ENABLED (`http2 on` on 443) |
| HTTP/3 | DISABLED |
| keepalive | `keepalive_timeout 65`; `proxy_http_version 1.1` on locations |
| upstream keepalive pool | NOT configured as a named `upstream { keepalive N }` (variable `proxy_pass`) |
| proxy cache for HTML | DISABLED |
| static `/_next/static` | `max-age=31536000, immutable` |
| fonts | 1 year |
| media / webp banners | 30 days (hero also has a `max-age=0` then 2592000 from stacked headers) |
| TLS | TLSv1.2 + TLSv1.3 |
| HTML cache | none — passes Next headers through |

Access log format is the default `main` **without** `$request_time` / `$upstream_*`. Temporary timing was **not** added to live nginx because `nginx/nginx.conf` is claimed. Classification used:

| Hop | Median TTFB |
|---|---:|
| Next `:3000` retail home | 14 ms |
| Nginx `:443` loopback | 25 ms |
| Public HTTPS from VPS | 87 ms |

Nginx adds ~10 ms. TLS on-box adds ~60–70 ms. The remaining 1.2 s from Iran is the public path.

---

## Node / Next.js

| Item | Value |
|---|---|
| Host node | v20.20.2 |
| Web container | `next-server` **v15.5.23**, `NODE_ENV=production` |
| API | `node dist/main`, `NODE_ENV=production` |
| Package manager | npm (lockfile in repo); runtime is Docker images |
| Process manager | Docker Compose, not PM2 (PM2 empty) |
| Workers | one Next process in `taranom_web` (11 PIDs), one API process |
| Memory limit | none on taranom_* (share 3.73 GiB host); `seo_auto_web` capped 768 MiB |
| Dev mode | **NO** (`next dev` not running) |
| Internal API | `API_INTERNAL_URL=http://api:4000/v1` — correct, no public hop inside Docker |
| Public API env | `NEXT_PUBLIC_API_URL=https://poshaktaranom.com/api/v1` |

---

## SSR / ISR / Cache

| Surface | Code intent | Live headers | Verdict |
|---|---|---|---|
| Retail home | `revalidate=60` + `force-static` | `s-maxage=60`, prerender | **ISR ENABLED** |
| Wholesale home | root `revalidate=60` only | `no-store` | **SSR / MISCONFIGURED vs retail** |
| Category both | `revalidate=300` + searchParams | `no-store` | **Dynamic SSR** |
| Product both | `cache: 'no-store'` on slug fetch | `no-store` | **Dynamic SSR** (price/stock safe) |
| Blog post | `revalidate=300` | `no-store` | **Declared ISR, live SSR** |
| Checkout/account | dynamic | `no-store` | correct |
| Next Data Cache | used on CMS/settings | ENABLED | |
| Redis | running, not HTML cache | ENABLED for app, NOT HTML |
| Nginx HTML cache | none | DISABLED |
| CDN HTML cache | Cloudflare gray | NOT_APPLICABLE |

Cold vs warm on VPS:

- Retail home: always ~14 ms (ISR HIT)
- Wholesale home: 527 ms then ~110 ms
- Public Iran: little warm benefit because TLS/path dominate

---

## API

Public URL prefix: `https://poshaktaranom.com/api/v1` (Iran probe, n=10). These numbers include the same Iran path as HTML.

| API | Median | P75 | P95 | Cache | Notes |
|---|---:|---:|---:|---|---|
| `/health` | 1553 | 1581 | 2567 | none | On-VPS **2 ms** |
| `/settings/public?channel=RETAIL` | 1910 | 2969 | 4565 | ISR 120s in RSC | Path-bound |
| `/cms/site-content/RETAIL/home` | 1671 | 1793 | 3886 | revalidate 60 | Path-bound |
| `/products?channel=RETAIL&limit=12` | 2354 | 2625 | 4048 | listing | On-VPS not separately timed |
| `/products/slug/linen-shirt-manteau-golrokh?channel=RETAIL` | 2033 | 2130 | 3070 | no-store | On-VPS **~70 ms** |
| `/categories?channel=RETAIL` | 2066 | 2365 | 2952 | | Path-bound |
| `/blog/posts?channel=RETAIL&limit=6` | 1961 | 2076 | 4437 | revalidate 300 | Path-bound |

No public API is slow **on the VPS**. All public medians >300 ms are Iran path, not query time. Product slug on localhost **70 ms** is acceptable (P3 if you want <30 ms later).

---

## Database

| Item | Value |
|---|---|
| Engine | PostgreSQL 16 Alpine (`taranom_postgres`) |
| Connections | 6 rows in `pg_stat_activity` (5 null / 1 active); `max_connections=100` |
| Pool | TypeORM default inside API container; no saturation |
| Redis | `taranom_redis` healthy; INFO memory empty in this probe (CLI grep miss) — process 13.5 MiB |
| Slow query log | **not enabled** (production safety) |
| `pg_stat_statements` | not confirmed in this window |

No evidence of a database bottleneck. Product API 70 ms on-box is not a 300 ms+ critical query. Heavy logging was not turned on.

---

## CDN / Cloudflare

| Check | Result |
|---|---|
| NS | Cloudflare |
| Proxy | **DNS only** — A = origin `5.75.200.102` |
| `cf-cache-status` | ABSENT |
| `age` | ABSENT |
| `server-timing` | ABSENT |
| `Server` | `nginx/1.31.2` |
| `content-encoding` | gzip via Vary: Accept-Encoding (HTML) |
| Brotli / HTTP/3 / Early Hints / APO | NOT_APPLICABLE while gray-cloud |
| Browser Cache TTL | N/A at CF; origin headers apply |

Orange-cloud + cache rules for public ISR HTML is the highest-leverage network fix **without leaving this VPS**.

---

## LCP Element Analysis

Retail home LCP candidate (code + live headers):

- Element: first hero slide, local WebP `/banners/hero-product-2026-v2/retail-01.webp` (+ mobile twin)
- Size: **42170 B** desktop, **42052 B** mobile
- Format: WebP (not `/_next/image` JPEG transcode)
- `fetchPriority=high` + media preloads in `RetailHero`
- Banner `Cache-Control`: 30 days (plus a stacked `max-age=0` from Next static file headers)
- Hashed JS/CSS: `public, max-age=31536000, immutable` — correct
- Hero is a Client carousel; only slide 0 should stay eager

LCP is **TTFB-bound from Iran**, not a multi-megabyte hero. Estimated lab LCP from this path: TTFB 1.3 s + image ~0.3–0.8 s ≈ **1.6–2.2 s** if the hero paints first; worse if GTM/fonts or carousel JS win. **Lighthouse lab this session: NOT_RUN (PSI 429).** Field CWV: NOT_AVAILABLE.

Wholesale home preloads `logo-128.png` and Enamad seal — LCP may be logo/seal, not product hero. TTFB 2.2 s already fails the 2.5 s LCP budget before paint.

---

## Root Causes

### A. Server Resource Bottleneck — NO (idle)

Steal 0%, idle ~90%, RAM available, swap 0, disk await <2 ms.

### B. Network / Datacenter Bottleneck — YES (primary for Iranian users)

```text
On-box home TTFB     = 14 ms
On-box public HTTPS  = 87 ms
Iran home TTFB       = 1317 ms
Iran health TTFB     = 1553 ms
Iran TLS median      = 695 ms
```

Hetzner Nuremberg is a long path from Iran. Cloudflare is not proxying, so every HTML hit pays that path.

### C. Application Bottleneck — YES (secondary)

Wholesale home SSR; category/PDP/blog `no-store`; large HTML; middleware rewrite on every retail request (small, required).

### D. Database Bottleneck — NO

On-box product API ~70 ms; 6 connections.

### E. Cache Architecture Problem — YES (secondary)

Retail home ISR works. Everything else public HTML is uncached at nginx and CF.

### F. Frontend/LCP Bottleneck — PARTIAL

Hero bytes are fine. Client carousel + third-party Enamad preload remain P3 after TTFB is fixed.

---

## Severity Matrix

| ID | Sev | Finding |
|---|---|---|
| NET-01 | P1 | Iran → Nuremberg TTFB ~1.3–2.3 s while on-box is 14–140 ms |
| CF-01 | P1 | Cloudflare DNS-only; no edge HTML cache |
| APP-01 | P1 | Wholesale home `no-store` (on-box 110–527 ms vs retail 14 ms) |
| APP-02 | P2 | Category always dynamic via `searchParams` |
| APP-03 | P2 | PDP `cache: 'no-store'` — keep short ISR or stale-while-revalidate, do not long-cache price/stock |
| APP-04 | P2 | Blog `revalidate=300` does not emit ISR headers |
| HTML-01 | P2 | Retail home HTML ~384 KB uncompressed |
| NGX-01 | P3 | No `$upstream_response_time` in access log; no brotli; no HTTP/3 |
| CAP-01 | P3 | 2 vCPU / 3.7 GiB + Xray/lead/seo_auto/Chromium neighbors |
| DISK-01 | P3 | Root 77% full — watch, not today’s latency |

No P0.

---

## Recommended Fixes

Do these **on the current VPS**. Do not migrate first.

1. **Cloudflare orange-cloud** for `.ir` and `.com` after confirming SSL mode Full (strict). Cache Rule: cache HTML for `/` only where `s-maxage` is present; bypass `/account`, `/checkout`, `/admin`, `/portal`, `/api`.
2. Give wholesale home the same `force-static` + `revalidate=60` as retail. Do not cache checkout/account.
3. Split unfiltered category from filtered `searchParams` so `/category/{slug}` can ISR.
4. Replace PDP `cache: 'no-store'` with short `revalidate` (30–60 s) if stock/price staleness of one minute is acceptable; otherwise keep no-store and accept SSR.
5. Find why blog posts emit `no-store` despite `revalidate=300`.
6. Optional: brotli in nginx image; HTTP/3 only after CF proxy (CF terminates QUIC).
7. Do not put long-lived HTML cache on product price/stock without a purge on order.
8. Do not move to shared hosting.

---

## VPS vs Shared Hosting Decision

Numeric comparison:

```text
CPU steal p95                 = 0%
Disk await                    = 0.3–1.5 ms
On-box retail home TTFB       = 14 ms
On-box API health             = 2 ms
On-box product API            = 70 ms
Public from VPS home TTFB     = 87 ms
Iran public home TTFB         = 1317 ms
Iran public health TTFB       = 1553 ms
Conclusion                    = path/TLS to Iran is primary; VPS compute is healthy
```

Shared hosting cannot run Next 15 + Nest + Postgres + Redis + MinIO + Meilisearch as deployed. An Iran VPS *could* cut RTT, but that is a new VPS, not shared hosting, and Cloudflare orange-cloud is the cheaper first experiment.

---

## Final Decision

```text
OPTIMIZE_CURRENT_VPS_FIRST
```

Shared hosting migration recommended: **NO**

---

## Before/After Metrics

This phase is diagnosis only. No optimization was deployed.

| Probe | Before (this session) | After |
|---|---|---|
| Retail home Iran median TTFB | 1317 ms | not changed |
| Wholesale home Iran median TTFB | 2181 ms | not changed |
| On-box retail home | 14 ms | not changed |
| PSI / Lighthouse | NOT_RUN (429) | — |

---

## Definition of Done checklist

- [x] Both sites tested
- [x] TTFB n=10 on primary routes
- [x] Nginx vs upstream classified (loopback method; live log format not mutated)
- [x] SSR / API / DB separated
- [x] LCP element identified (hero WebP); lab LCP number NOT_RUN
- [x] CPU / RAM / Disk / Network recorded
- [x] Cache architecture recorded
- [x] VPS vs shared hosting decided with numbers
- [x] This report written
