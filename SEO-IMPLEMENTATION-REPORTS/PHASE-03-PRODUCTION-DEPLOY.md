# PHASE-03 PRODUCTION DEPLOY

Date: 2026-08-24  
Task: TASK-20260824-002  
Scope: PHASE-03A + PHASE-03B only

## Identifiers

| Field | Value |
|-------|--------|
| Release commit | `70638db0c6dd2b2f3ddb63634a6185f148c8c0f0` |
| Release short | `70638db` |
| Rollback target | `7fea689e31041d54160f800ddaee90f17bc53eae` (`7fea689`, PHASE-02B docs on live `13bf657`) |
| Deploy method | Existing `scripts/auto-deploy.sh` on VPS `/opt/taranom` (timer picked `origin/master`, `docker compose build api web`, `up -d`, nginx restart, existing schema safety-net SQL, API health) |
| Deploy start | 2026-08-24T15:36:30Z |
| Deploy end | 2026-08-24T15:49:45Z |
| Deploy status | **SUCCESS** |
| Prisma `migrate deploy` | **NOT RUN** — no Prisma schema; stack is TypeORM; PHASE-03 forbids new migrations |
| VPS HEAD | `70638db` |
| API health | HTTP 200 |

## Isolated ship (39 files)

Runtime: nginx apex one-hop; sitemap `BLOCKED_PATH` `/retail`; `RetailOtpLogin` public hrefs; footer React keys; `gsc-legacy-redirects` + middleware 301s. Reports + census scripts included. Unrelated dirty backups/audit packages were not staged.

## Storefront smoke

| Check | Result |
|-------|--------|
| `/` | **PASS** — 200, 337 KB, canonical `https://www.poshaktaranom.ir`, 12 product links, ISR `s-maxage=60` |
| `/products` | **PASS** — 200, 24 product links, canonical `/products` |
| `/category/shomiz` | **PASS** — 200, 16 product links |
| `/category/women-pants` | **PASS** — 200, self-canonical, 6 product links |
| PDP golrokh | **PASS** — 200, JSON-LD present, canonical www |
| PDP ماهین | **PASS** — 200, JSON-LD, canonical `/products/maserati-pants-mahin` |
| `/blog` + article | **PASS** — 200 |
| `/checkout` | **PASS** — 200, `noindex`, `private, no-store` |
| `/account` | **PASS** — 200, `noindex, nofollow`, `private, no-store` |
| `/sitemap.xml` | **PASS** — 200 |
| `/robots.txt` | **PASS** — 200, `Disallow: /account` |
| `/retail` in canonical | **none** on sampled pages |

**Storefront: PASSED**

## Product legacy 301

Tested `https://www.poshaktaranom.ir/product/161/شلوار-ماهین/` (control URL, trailing slash):

1. **308** strip slash (Next default; same class as live `/uploads/` → `/uploads`)
2. **301** `/products/maserati-pants-mahin`
3. **200** self-canonical `https://www.poshaktaranom.ir/products/maserati-pants-mahin`

Without trailing slash: **one-hop 301** → same target. No loop. Wrong-target: no.

**Product legacy 301: PASSED**

## Category legacy 301s

| Source | Result |
|--------|--------|
| `/category/20` | **301** → `/category/women-pants` **200** self-canonical |
| `/category/20/` | 308 slash then **301** → `/category/women-pants` **200** |
| `/category/20/شلوار/` | 308 slash then **301** → `/category/women-pants` **200** |

**Category legacy 301s: PASSED**

## Malformed URL internal references

Needles `/productsجدیدترین‌ها`, `/contactتماس`, `/shippingارسال`, `/collectionsکلکسیون‌ها`, `/productsمانتو`, `/&`, `/$`:

- Source `href` / canonical / JSON-LD: **0** (spec negative assertion only)
- Live HTML (home, women-pants, ماهین PDP): **0**
- Sitemap locs: **0**
- Live probes: all **404** (allowed)

**Malformed URL internal references: 0**

## Intentional 404/410

| URL | Result |
|-----|--------|
| `/product/152/مانتو-شومیزی-ترگل/?vid=1234` | 308 slash → **410** (not a content 301) |
| `/product/151/مانتو-شومیزی-ساغر/?vid=1221` | 308 → **410** |
| `/product/160/مانتو-شومیزی-سهند/?vid=1291` | 308 → **410** |
| `/category/17/کت-کتان/` | 308 → **404** |
| `/category/10` | **200** title «دسته‌بندی یافت نشد», meta **noindex**; **not** redirected to home/women-pants (no guessed mapping) |

**Intentional 404/410 behavior: PASSED** (no irrelevant redirects)

## Account / uploads / feed

| Check | Result |
|-------|--------|
| `/account` | 200 noindex,nofollow; robots Disallow; **not in sitemap** |
| `/uploads/` | 308 → **410** noindex; listing not opened |
| `/blog/31-معرفی/feed/` | apex 301 → slash 308 → **410** |

## Sitemap

- Count: **77** (unchanged vs PHASE-03A baseline)
- All **200**, **0** redirects, **0** noindex, canonical host `www.poshaktaranom.ir`
- Post-deploy `npm run seo:check`: `.ir` 77/77, `.com` 83/83

**Sitemap: PASSED**

## Internal links

Live census after deploy: 1027 crawl hrefs, 105 owned targets.

| Check | Count |
|-------|------:|
| Broken owned internals | **0** |
| Public `/retail/*` hrefs | **0** |
| Redirect-source hrefs in nav | **0** |
| `.com` hrefs | wholesale homepage switcher `https://poshaktaranom.com/` only (pre-existing channel link, not SEO nav product URLs) |
| Malformed paths | **0** |

**Internal broken links: 0**

## HTTP apex (PHASE-03A)

`http://poshaktaranom.ir/` → **301** `https://www.poshaktaranom.ir/` → **200** (one hop).

## Analytics regression

- SSR: `GTM-NKBCGQJV` present
- `GTM-PKHBQ74Z` absent
- No app-level `gtag/js?id=G-F2V7VSJMLE`

**Analytics regression: PASSED**

## SEO regression

Canonical www, no `/retail` leak, robots/sitemap 200, fake URL 404, product JSON-LD present, `seo:check` 0.

**SEO regression: PASSED**

## Rollback required

**NO** (`NOT_REQUIRED`)

## Remaining (not rollback)

- Trailing-slash URLs still take a Next **308** before middleware 301/410. `next.config.ts` is owned by TASK-20260823-001; not changed.
- `/category/10` remains a noindex “category not found” 200; do not guess a 301.
- GSC Inspect / Validate Fix are owner actions (`PHASE-03-GSC-MANUAL-ACTIONS.md`).
