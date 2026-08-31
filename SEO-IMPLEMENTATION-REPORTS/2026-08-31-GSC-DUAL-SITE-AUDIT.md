# GSC dual-site audit — 2026-08-31

Account: `rashidhamedas@gmail.com`  
Properties: `sc-domain:poshaktaranom.ir` (retail) and `sc-domain:poshaktaranom.com` (wholesale)  
Window: last ~3 months (GSC UI dates 2026-05-30 → 2026-08-29/30)  
Source: logged-in Search Console in the Cursor browser, plus live HTTPS probes via `127.0.0.1:10808`

This report records **measured** GSC numbers and **code that is in this task’s working tree**. Live storefronts still run the previous deploy until this branch is committed and shipped.

## Verdict

Both domain properties are verified, HTTPS-clean, and already have a successful sitemap index. Indexation is not the main limiter. The two things that actually hurt growth are (1) **mobile LCP over 4s on wholesale**, (2) **retail HTML still leaking wholesale product copy/seoMeta into RSC** on PDP and home until this deploy, and (3) **Google still spending crawl budget on leftover WordPress URLs**.

Do **not** Validate Fix the noindex / redirect buckets. Most of those rows are correct behavior (apex→www, `/account`, filtered catalog, dead WP paths).

## Search performance (Web, 3 months)

| Property | Clicks | Impressions | CTR | Avg position |
|---|---:|---:|---:|---:|
| `poshaktaranom.ir` | 109 | 4.4K | 2.5% | 6.2 |
| `poshaktaranom.com` | 56 | 1.29K | 4.4% | 7.0 |

Retail query “ترنم” has 750 impressions and 2 clicks. Wholesale “ترنم” has 352 impressions and 1 click. Both sites are still winning on **brand**, not category/product intent.

Retail pages still earning clicks from **legacy hosts/paths**:

- `https://poshaktaranom.ir/` 41 clicks / 2,753 impr (apex; should 301 to www)
- `https://www.poshaktaranom.ir/` 40 / 1,037
- `https://poshaktaranom.ir/page/3/تماس-با-ما/` 9 / 83
- `https://www.poshaktaranom.ir/blog/summer-manto-trends-1405` 8 / 207
- `https://poshaktaranom.ir/shop/` 3 / 15
- `http://www.poshaktaranom.ir/` 2 / 160
- `https://poshaktaranom.ir/wholesale/` 1 / 23

Wholesale clicks are almost all the homepage (46 of 56). `/wholesale` still has 2 clicks.

## Page indexing (All known pages, last update 2026-08-21)

| Reason | Retail `.ir` | Wholesale `.com` | Action |
|---|---:|---:|---|
| Indexed | 171 | 49 | Keep. Request index only after deploy for new 200 self-canonicals. |
| Not indexed | 168 | 116 | Do not mass-fix. |
| Page with redirect | 74 (validation Failed) | 48 (Failed) | Expected (apex/www + legacy 301). Do not Validate Fix. |
| Excluded by noindex | 45 (Failed) | 12 (Failed) | `/account`, filtered listing, OTP. Keep noindex. |
| Not found (404) | 31 (Failed) | 1 (Started) | Leftover WP. Do not invent redirects. |
| Crawled – currently not indexed | 12 (Failed) | 9 (Failed) | Quality/soft. Fix content + LCP, do not force index. |
| Alternate with proper canonical | 3 (Started) | 1 (Started) | Healthy. |
| Duplicate, Google chose different canonical | — | 3 (Not started) | Inspect only those 3 URLs after deploy. |
| Duplicate without user-selected canonical | 1 (Started) | 1 (Not started) | Inspect the exact URL; do not guess. |
| Blocked 403 | 1 (Started) | 0 | Inspect the exact URL; do not guess. |
| Blocked by robots.txt | 1 (Started) | 0 | robots report says all files valid; inspect the sample URL. |
| Discovered – currently not indexed | 0 (Passed) | 41 (Passed) | Wholesale discovery backlog; sitemap already Success. |
| Blocked other 4xx | 0 | 0 | — |

## Sitemaps

| Property | Submitted | Last read | Status | Discovered |
|---|---|---|---|---:|
| `.com` | `https://poshaktaranom.com/sitemap.xml` | 2026-08-31 | Success | 84 |
| `.ir` apex | `https://poshaktaranom.ir/sitemap.xml` | 2026-08-30 | Success | 80 |
| `.ir` www (submitted this session) | `https://www.poshaktaranom.ir/sitemap.xml` | 2026-08-31 | Couldn't fetch (first read) | 0 |

Apex retail sitemap already 301s to www and is the working submission. The www row was added so Google has the canonical host; first fetch failed. **Do not delete the apex Success row.** Recheck the www row in 24h; if it stays “Couldn't fetch”, remove only that row.

Live sitemap counts from this session’s probes: retail pages 8 + products 60 + cats 10 + blog 2; wholesale pages 13 + products 58 + cats 10 + blog 3. Two published retail posts (`jacket-fabric-guide`, `best-womens-fall-clothes-1405`) are missing from live `blog.xml` until this branch deploys.

## Experience

| Report | Retail `.ir` | Wholesale `.com` |
|---|---|---|
| Core Web Vitals | No CrUX data (mobile + desktop) | Mobile: **11 poor, 0 NI, 0 good**. Issue: **LCP > 4s**. INP/LCP-2.5s = 0. Desktop: not enough data. Last update 2026-08-30. |
| HTTPS | 23 HTTPS / 0 non-HTTPS | 11 HTTPS / 0 non-HTTPS |
| Security issues | No issues | No issues |
| Manual actions | Not opened separately; overview had no warning | No issues |

LCP is the only GSC speed finding with enough field data. Hero/LCP files are claimed by other tasks (`RetailHero`, wholesale home, `next.config.ts`). This task did not edit them.

## Shopping / enhancements

| Report | Retail `.ir` | Wholesale `.com` |
|---|---|---|
| Product snippets | 16 valid / 0 invalid | 0 valid / 1 invalid: missing `price` in `offers` (intentional while wholesale price is hidden) |
| Merchant listings | 11 valid / **27 invalid** — critical: **missing `image`** | 0 valid / 1 invalid: missing `price` |
| Merchant improvements | 38 missing return policy; 38 missing shippingDetails; 29 missing description; 27 missing productGroupID | 1 missing return policy; 1 missing shippingDetails |
| Breadcrumbs | 14 valid / 0 invalid | 2 valid / 0 invalid |

Return-days and shipping amounts were **not** invented. Those fields stay off until `/admin` has a real policy.

Code in this branch absolutizes product images and copies parent image/description/`productGroupID` onto `ProductGroup` variants. That is the safe fix for the 27 missing-image merchant rows. Validate Fix **after** deploy, not before.

## Settings applied in GSC this session

Done:

- Linked GA4 `www.poshaktaranom.ir` (547378194) / stream `ReRetail - poshaktaranom.ir` to `sc-domain:poshaktaranom.ir`
- Linked GA4 `www.poshaktaranom.com` (547352333) / stream **`Retail - poshaktaranom.com`** to `sc-domain:poshaktaranom.com`
- Confirmed Search generative AI = Include (retail)
- Confirmed ownership verified; crawl stats retail 1.5K / 90 days; robots.txt “all files valid”
- Submitted www retail sitemap (first fetch failed; apex Success kept)

Not done (on purpose):

- Validate Fix on redirect / noindex / 404 groups
- Request indexing for `/account`, `/_next`, fonts, API, HTTP, 301 sources, `/shop/`, `/wholesale/` on `.ir`
- Change of address
- Merchant Center (not in the association picker)
- Renaming the `.com` GA4 stream (still labeled “Retail”) — owner should rename it to Wholesale in Analytics

## Live HTML vs GSC (this session)

- Both homes 200, ISR, TTFB ~0.9–1.0s through the Windows proxy
- Retail home HTML ~339 KB; wholesale ~251 KB
- Retail `/products` and PDP were `Cache-Control: no-store` on live (products ISR is in this branch; PDP fetch is claimed elsewhere)
- Retail `/category/shomiz` already ISR HIT
- Canonicals/robots on public pages are host-correct
- Retail RSC still contained wholesale `seoMeta` / «خرید عمده» until `RetailProductGrid` slims cards (this branch). PDP JSON is still owned by TASK-20260826-001
- Footer live still says «خرید عمده»; this branch changes the visible anchor to «سایت بوتیک‌داران»
- Home CTA/FAQ «حداقل سفارش» is **CMS DB**, not only code defaults — edit `/admin/site-content`

## Code in TASK-20260831-003 (not live until deploy)

- Slim retail home product payload (`slimRetailCatalogProduct`)
- Unfiltered `/products` force-static ISR; filters stay client + `noindex,follow`
- Products layout title: «همه محصولات فروشگاه ترنم»
- Blog sitemap unions published indexable posts
- Retail footer/FAQ/defaults: no «خرید عمده» as the money anchor
- JSON-LD: absolute product images; variant image/description/productGroupID

Not edited (claimed by other same-day tasks): `middleware.ts`, `next.config.ts`, `product.service.ts`, channel projection, PDP pages, `RetailHero`.

## Owner next

1. Commit + deploy this branch, then re-probe retail home HTML for leftover `خرید عمده` / `seoMeta` in `__next_f`.
2. In `/admin/site-content` rewrite retail home CTA/FAQ so live CMS no longer targets عمده.
3. After deploy: inspect `https://www.poshaktaranom.ir/`, `/products`, money PDPs, and the two blog slugs; request indexing **only** if they are 200 self-canonical.
4. In GSC merchant listings, Validate Fix **Missing field image** after the JSON-LD deploy is live.
5. In GA4, rename stream `Retail - poshaktaranom.com` to Wholesale.
6. Do not add `hasMerchantReturnPolicy` / `shippingDetails` until return and shipping days exist as real business facts.
7. Next speed task (other owners): wholesale mobile LCP > 4s on 11 URLs.
