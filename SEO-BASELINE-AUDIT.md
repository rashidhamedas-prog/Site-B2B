# SEO Baseline Audit — poshaktaranom.com (wholesale) + poshaktaranom.ir (retail)

Date: 2026-08-11 · Branch: `master` (synced with `origin/master`) · Evidence: live probes + code audit by 4 parallel agents.
Raw baseline snapshots: `.seo-baseline/` (robots, sitemaps, per-URL validation CSVs). Merged inventory: `SEO-URL-INVENTORY.csv` (141 URLs).

## Architecture snapshot

- Single Next.js 15 App Router app (`apps/web`) serves both domains; `middleware.ts` rewrites retail-host requests into `/retail/*`. NestJS API (`apps/api`), nginx in front (host canonicalization: `.com` www→apex, `.ir` apex→www, HTTP→HTTPS all 301).
- `robots.txt` and `sitemap.xml` are dynamic per host and correct in structure.

## P0 — Critical (fixed in this pass)

| # | Finding | Evidence |
|---|---|---|
| 1 | **Wholesale PDP soft-404**: missing products rendered 200 + `index,follow` skeleton (no `notFound()`), product body fetched client-side (no SSR H1/price/description) | `apps/web/src/app/(wholesale)/products/[slug]/page.tsx` (before), live probe `/products/<garbage>` → 200 |
| 2 | **57 wholesale product canonical mismatches**: page canonical pointed to stale descriptive slugs from `seoMeta` (e.g. `coats00015` → canonical `linen-sport-jacket-erika`, which 404s) — sitemap URL and canonical disagreed on every one | `SEO-URL-INVENTORY.csv` rows flagged `CANONICAL_MISMATCH` |
| 3 | **Retail layout default canonical = homepage**: every retail page without its own canonical (e.g. `/collections`, streamed 404s) claimed `https://www.poshaktaranom.ir` as canonical | `apps/web/src/app/retail/layout.tsx` (before) |
| 4 | **`{search_term_string}` crawled literally**: wholesale WebSite JSON-LD SearchAction placeholder ended up in GSC as a crawled URL | `JsonLd.tsx` (before), GSC report |
| 5 | **Legacy WordPress URLs unhandled**: `/shop/*`, `/product/<id>/<slug>/`, `/wp-content/*`, `*/feed` → plain 404 (GSC "Not found (404)" — 27 pages on .ir) | live probes, GSC email |

## P1 — High (fixed in this pass)

| # | Finding |
|---|---|
| 6 | `/retail/*` tree directly reachable on both hosts (cross-host duplicate content; canonical was the only mitigation) |
| 7 | Search/filter/pagination listing states indexable on both channels (`/products?q=…` etc.) |
| 8 | Retail blog `[slug]` page: mojibake (double-encoded UTF-8) in fallback metadata title, breadcrumb names, author name |
| 9 | Contradictory hardcoded business stats (۱۰+ vs ۱۴ سال تجربه، +۲۰۰ vs +۵۰۰ مشتری، foundingDate 2011) across 6 files |
| 10 | GA4 `page_view` double-fired on initial mount (two effects both sent the event) |
| 11 | Hero mobile `<source srcSet={raw}>` bypassed the Next image optimizer (multi-MB LCP on mobile) |
| 12 | OG images 2.2 MB / 3.0 MB (`og-retail.jpg`, `og-wholesale.jpg`) |
| 13 | `not-found.tsx` had no `noindex` |
| 14 | Sitemap + blog SSR fetches used the public API origin from inside the container (DNS/latency fragility) |

## P2 — Medium (fixed where low-risk)

- Retail `/collections` was fully client-rendered (empty HTML for crawlers) → now SSR with revalidate 300.
- Retail category banner grid marked first banner `priority` (competed with hero LCP) → lazy.
- `/api/*` responses had no `X-Robots-Tag` (robots-disallow only) → nginx now sends `noindex, nofollow`.
- `/payment/` missing from robots disallow.

## P3 — Backlog (documented, not done in this pass — see SEO-REMAINING-MANUAL-ACTIONS.md)

- SSR initial product grid on the two `/products` listings (currently client-fetched after paint; discovery is covered by sitemap + home grid + PDP links).
- Shared chrome (header/footer/settings) makes repeated client API calls — consolidate into one server-provided context.
- Unused deps in `apps/web/package.json` (`swiper`, `next-seo`, `chart.js`, `react-chartjs-2`) — install weight only, no bundle impact.
- Old descriptive wholesale product slugs (pre-rename) 404; a per-product 301 map would need an API lookup by legacy slug.

## What was already healthy

- nginx host canonicalization + HSTS + HTTPS 301s; trailing-slash normalized by Next (308).
- Dynamic per-host robots/sitemap; sitemap URLs use resolvable code slugs, ACTIVE + channel-filtered; no query strings/duplicates.
- Retail PDP: `notFound()`, canonical guard (`resolvePublicProductCanonical`), server JSON-LD (Product/Breadcrumb, IRR), SSR product body.
- Legacy Yoast sitemap paths 301 in `next.config.ts`; blog redirect system (admin-managed) for blog paths.
- Prices stored in rials → JSON-LD `priceCurrency: IRR` is semantically correct.
