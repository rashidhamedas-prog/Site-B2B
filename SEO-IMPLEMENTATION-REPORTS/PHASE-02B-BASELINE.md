# PHASE-02B BASELINE

Project: `poshaktaranom.ir` (retail)  
Date: 2026-08-23  
Git branch: `ai/TASK-20260822-004-retail-pdp`  
HEAD: `1f9d9bf4abb3ad19fe16f71aff258062df9516b4`  
Probe: Windows workstation, `curl.exe -sS -L`  
Production was **not** patched yet. These numbers are the pre-patch live site.

Dirty working tree from PHASE-01 (analytics) was left intact; Phase 02B patches were merged into those files without overwriting unrelated Phase 01 diffs.

---

## URLs

| Page | URL |
|------|-----|
| Home | `https://www.poshaktaranom.ir/` |
| Catalog | `https://www.poshaktaranom.ir/products` |
| Category | `https://www.poshaktaranom.ir/category/shomiz` |
| PDP | `https://www.poshaktaranom.ir/products/golrokh-linen-shirt-dress` |
| Blog | `https://www.poshaktaranom.ir/blog/trendy-womens-shirt-1405` |

---

## Document TTFB (curl, 3 runs)

TTFB = `time_starttransfer`. Size = `size_download` (decoded when curl decompresses).

| URL | Run1 | Run2 | Run3 | Median | HTTP | Size |
|-----|------|------|------|--------|------|------|
| Home | 2038 ms | 862 ms | 1009 ms | **1009 ms** | 200 | 466,176 B |
| Catalog | 649 ms | 831 ms | 731 ms | **731 ms** | 200 | 723,422 B |
| Category | 755 ms | 670 ms | 641 ms | **670 ms** | 200 | 156,905 B |
| PDP | 755 ms | 620 ms | 650 ms | **650 ms** | 200 | 34,084 B |
| Blog | 1018 ms | 603 ms | 587 ms | **603 ms** | 200 | 78,158 B |

Home extra probe (`Accept-Encoding: gzip` + `--compressed`):

| Field | Value |
|-------|--------|
| Cache-Control | `private, no-cache, no-store, max-age=0, must-revalidate` |
| x-middleware-rewrite | `/retail` |
| Content-Encoding | `gzip` |
| HTML compressed (encoded) | 134,917 B |
| HTML decoded | 466,176 B |
| Content-Type | `text/html; charset=utf-8` |

---

## Notes vs PHASE-02 audit (2026-08-22)

Home decoded HTML grew slightly (445 KB → 466 KB). Catalog grew (694 KB → 723 KB). TTFB is noisy from this path; medians above are this session’s baseline, not fabricated copies of Phase 02.

Live home document (this session) already contained a streamed hero preload with `imageSrcSet` pointing at `/_next/image?...retail-01.webp`. The empty `href=""` preload from the prior audit was not in the initial `<head>` of this capture; the LCP path still went through the image optimizer (JPEG transcode risk + `max-age=60`).
