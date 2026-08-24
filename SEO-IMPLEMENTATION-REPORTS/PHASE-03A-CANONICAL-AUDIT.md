# PHASE 03A — CANONICAL AUDIT
Date: 2026-08-23
Preference (unchanged): HTTPS + `www.poshaktaranom.ir` + public path (never `/retail/*` as canonical).

## Live host matrix

| Start | Hops | Final | Class |
|---|---:|---|---|
| `http://poshaktaranom.ir/` | 2 | `https://www.poshaktaranom.ir/` | REDIRECT_CHAIN (HTTP then apex→www) |
| `http://www.poshaktaranom.ir/` | 1 | `https://www.poshaktaranom.ir/` | EXPECTED_REDIRECT |
| `https://poshaktaranom.ir/` | 1 | `https://www.poshaktaranom.ir/` | EXPECTED_REDIRECT |
| `https://www.poshaktaranom.ir/` | 0 | same, 200 | CANONICAL |

## Duplicate URL classes (systemic, not GSC row)

| Class | Live behavior | Verdict |
|---|---|---|
| www vs apex | apex 301 → www | expected |
| http vs https | 301 to https | expected; apex HTTP is two hops |
| trailing slash | home sitemap omits slash; other paths no slash | consistent on sampled locs |
| `/retail/*` vs public | `/retail` and `/retail/products` are **200** + `X-Robots-Tag: noindex,nofollow`; public URL is canonical | expected; do **not** 301 (Torob rewrite loop) |
| `/products?categoryId=` / `?page=` / `?sort=` / `?q=` | 200, `noindex,follow`, canonical `/products` | expected utility URLs; not in sitemap |
| `/search`, `/shop` | 301 → `/products` | expected legacy |
| product slug aliases | code maps old descriptive slugs → current; **not mass-tested against unknown GSC URL** | EXPECTED_REDIRECT when map hits |
| `.com` vs `.ir` | footer «خرید عمده» → `https://poshaktaranom.com` | CROSS_DOMAIN_INTENTIONAL |

## GSC “Duplicate without user-selected canonical” (1 URL)

Exact URL **not in repository**. Do not add speculative redirects.

Likely remaining classes if that one URL is shown later:

1. HTTP/apex variant still in Google’s URL set (expected redirect, not a bug once crawled)
2. `/retail/...` vs public path (canonical already public)
3. trailing-slash or query variant

**NO_ACTION** until the GSC sample is exported.

## GSC “Alternate page with proper canonical” (3 URLs)

Usually valid. Live samples that already behave as alternates:

- `/products?page=2` → canonical `/products`
- `/products?categoryId=…` → canonical `/products`
- `/retail/products` → public `/products` canonical + noindex header

If the three GSC rows are these (or similar), **NO_ACTION_EXPECTED**. Exact GSC URLs still required to confirm.
