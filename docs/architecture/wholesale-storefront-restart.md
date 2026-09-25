# Wholesale storefront — restart program (discovery 2026-09-25)

**Owner decision 2026-09-25:** Track **C** — SEO+content program **and** phased UX redesign.

Modes locked this run:

| Skill | Mode | Reason |
| --- | --- | --- |
| website-architecture | redesign / audit (not greenfield) | Live `.com` storefront already ships home, catalog, PDP, portal, CMS, blog |
| seo-geo-architecture | discover → implement (phase 1+) | Baseline from live HTTP + HTML; GSC Wizard unavailable (trial ended) |
| weblog | retrofit / content-ops later | `/blog/*` + RSS + channel `WHOLESALE` already live |
| slack-search | N/A | No matching Slack messages for عمده / wholesale / poshaktaranom |

## Phase 1 runtime findings (2026-09-25 probe)

| ID | Severity | Evidence | Fix |
| --- | --- | --- | --- |
| W-P1-01 | P1 | Home HTML includes `FAQPage` JSON-LD (`faq:true`) | Removed from `WholesaleFaq` (+ landing); keep visible FAQ |
| W-P1-02 | P1 | `/products?page=2` SSR robots `index,follow` while client overlay intended noindex | `generateMetadata` + `wholesaleCatalogQueryIsUtility` |
| W-P1-03 | OK | Home featured cards = 12 | Keep ≤12–16 |
| W-P1-04 | OK | `/blog/search` `noindex,follow` | Keep |
| W-P1-05 | OK | Sitemap index 4 children; blog sitemap 6 locs | Keep |

Note: pagination here is a **client overlay**, not SSR page-2 HTML. Policy = noindex + canonical clean `/products` (not self-indexable empty shells).

## Confirmed facts (runtime)

| Check | Result | Evidence |
| --- | --- | --- |
| API health | 200 | `https://api.poshaktaranom.com/v1/health` |
| Home | 200, ~745ms, `index,follow`, canonical `https://poshaktaranom.com` | Node fetch 2026-09-25 |
| `/products` | 200, canonical self | same |
| `/blog` | 200, hub with published posts | browser + API |
| `/portal/register` | 200 | CTA target in CMS defaults |
| `/register` | 404 `noindex` | bare path unused — OK |
| `robots.txt` | Allow `/`; Disallow `/admin/`, `/portal/`, `/partners/`, `/api/` | live |
| `sitemap.xml` | sitemap index 200 | live |
| `/blog/feed.xml` | RSS 200, title وبلاگ عمده‌فروشی ترنم | live |
| Blog API | `GET /v1/blog/posts?channel=WHOLESALE` returns items | live |
| Slack | 0 results | search 2026-09-25 |
| GSC Wizard | blocked | subscription/trial ended |

Weblog sources refreshed: `.cursor/skills/weblog/cache/freshness.json` — 34/34 verified at 2026-09-24T23:07:30Z.

### Claim ledger (time-sensitive)

```text
W-CL-01 | FAQ rich results removed from Google Search | Google | official
https://developers.google.com/search/updates | 2026-09-24 | Sep 2026 updates feed
FAQ content may remain; do not promise FAQ rich results | confidence high | blog/home FAQ schema

W-CL-02 | HowTo rich results sunset | Google | official
https://developers.google.com/search/blog/2023/08/howto-faq-changes | revalidated via updates 2026-09-24
HowTo UI OK; no HowTo rich-result promise | confidence high

W-CL-03 | Sitemap protocol limits 50k URL / 50MB | Google | official
https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap | 2026-09-24
priority/changefreq ignored by Google | confidence high

W-CL-04 | llms.txt not used by Google Search | Google | official
AI optimization guide (skill snapshot) | needs-recheck if implementing GEO files
Do not ship llms.txt as Google requirement | confidence high | GEO

W-CL-05 | CWV good: LCP≤2.5s INP≤200ms CLS≤0.1 at p75 field | web.dev | official
https://web.dev/articles/defining-core-web-vitals-thresholds | 2026-09-24
Lab ≠ field; home product budget ≤12–16 cards | confidence high | performance-first
```

## Product frame (target — not a rebuild-from-zero)

- **Outcome:** B2B buyers (boutiques) discover, apply, get approved, see wholesale price, order with MOQ ≥ 6 per model.
- **Audience:** wholesale buyers on `poshaktaranom.com`; not retail shoppers (`.ir`).
- **Primary journeys:** home → apply/register (`/portal/register`) → approval → catalog/PDP → cart → checkout; content via `/blog`.
- **Non-goals:** second CMS/page builder; merge `.com`/`.ir`; invent article copy; GBP (Iran unsupported); fake prices for schema.
- **Preserve:** existing public URLs, CMS channel `WHOLESALE`, blog `(channel, slug)`, portal auth, product channel stock/price isolation.

## Route matrix (current = keep unless phase says otherwise)

| Route | Intent | Index | Owner |
| --- | --- | --- | --- |
| `/` | B2B hub / apply CTA | yes | CMS `home` |
| `/products`, `/products/[slug]` | catalog / PDP | yes if channel-visible | catalog |
| `/category/[slug]` | category landing | yes | catalog + CMS |
| `/wholesale` | cooperation terms | yes | CMS |
| `/about` `/contact` `/shipping` `/returns` `/privacy` `/terms` | trust/legal | yes | CMS |
| `/blog` `/blog/[slug]` `/blog/category/[slug]` | content | yes if published | BlogModule |
| `/blog/tag/[slug]` | tag cluster | no unless enabled | BlogModule |
| `/blog/search` `/blog/preview/*` | utility | noindex | BlogModule |
| `/blog/feed.xml` `/sitemaps/blog.xml` | feeds | n/a | BlogModule |
| `/portal/*` | account | no (robots Disallow) | auth |
| `/linen-collection` `/workshop` `/wholesale-manto-mashhad` | landing | yes if useful | CMS/code |

## Weblog audit (retrofit)

Already present: Nest `BlogModule` + storefront routes + `/admin/blog?channel=WHOLESALE`.  
Do **not** greenfield a second blog. Gaps to verify in a later implement slice (not assumed done):

- [ ] Hub card count ≤ 12–16
- [ ] Tag default noindex
- [ ] Slug change → 301 / gone → 410
- [ ] JSON-LD matches visible (no FAQ rich-result claim)
- [ ] Owner content ops schedule (never fabricate posts)

## Phased program (dependency order)

| Phase | Name | Outcome | Stop if |
| --- | --- | --- | --- |
| 0 | Architecture lock (this doc) | Modes, preserve URLs, non-goals | Owner rejects preserve-URL |
| 1 | Technical SEO QA sample | robots/canonical/sitemap/schema fixtures for home, category, PDP, blog | P0 indexability |
| 2 | IA / conversion polish | register CTA, MOQ clarity, portal funnel — no URL mass change | Business rule unknown |
| 3 | Weblog content-ops | briefs + publish via admin; no schema rewrite | Owner has no copy |
| 4 | Performance pass | home LCP, product list budget, image priority | Field CWV regression |
| 5 | Optional visual redesign | new skin under existing CMS blocks | Conflicts with retail task claims |

## Open decisions (block implementation)

1. **Scope of «شروع کامل»:** (A) SEO+content program only, (B) UX redesign of home/catalog, (C) both, (D) only gap-fix vs retail parity.
2. **Visual direction:** keep current green/gold B2B skin, or new design system pass.
3. **GSC access:** restore GSC Wizard or export Search Console CSV for baseline clicks/impressions.
4. **Concurrency:** `TASK-20260925-001` (retail audit) owns same worktree + shared `CmsPage.tsx` + `docs/WORKLOG.md` + `active.yaml`. Wholesale implement must wait for release or use a separate worktree/branch with non-overlapping claims.

## Recommendation

Do **not** rebuild wholesale from zero. Run **Phase 1 → 2 → 3** on a dedicated task/worktree after retail claims release (or parallel worktree). Treat Phase 5 as optional and high-risk for SEO if URLs or templates thrash.
