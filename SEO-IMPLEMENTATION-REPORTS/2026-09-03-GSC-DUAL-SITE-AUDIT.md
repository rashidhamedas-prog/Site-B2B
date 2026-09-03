# GSC dual-site audit + mobile LCP — 2026-09-03

Account intended: `rashidhamedas@gmail.com` (same as 2026-08-31).  
Properties: `sc-domain:poshaktaranom.ir` (retail) and `sc-domain:poshaktaranom.com` (wholesale).

**GSC UI this session:** Cursor browser MCP failed to attach (`Server not found: cursor-ide-browser`). No Validate Fix, no sitemap delete, no index request was clicked today. Field numbers below that say “GSC UI” are from the 2026-08-31 logged-in walkthrough unless marked live HTTPS probe.

Live probes today used Node TLS via `127.0.0.1:10808` plus VPS loopback. Windows `curl.exe`/Schannel still fails TLS on `www.poshaktaranom.ir`; Node and the VPS succeed.

## Verdict

Indexation is still not the limiter. The ranking sites are brand queries with thin category/product clicks. The field issue that actually hurts wholesale is **mobile LCP > 4s**. Today’s origin evidence explains why that stays poor even after ISR:

1. LCP hero/fonts/logo were advertised as `Cache-Control: max-age=0` **and** `max-age=2592000`. Browsers keep the stricter `max-age=0`, so every mobile visit re-downloads the LCP image.
2. Wholesale header `<img src="/logo-128.png">` is the first image in the HTML, so Next preloads the logo **ahead of** the actual LCP hero.
3. Wholesale mobile hero was **86 KB** (retail mobile hero is 42 KB).
4. Retail product JSON-LD `image` was an absolute URL on **`.com`**, while the page canonical is **`.ir`**. Merchant “missing image” can follow from that mismatch. Sara’s original file is also a **3.7 MB JPEG** (old upload; processor was not applied).

Do **not** Validate Fix redirect / noindex / 404 groups. Those rows are still mostly correct behavior.

## Goals / non-goals

- Goals: cache LCP bytes, stop logo/hero contention, put JSON-LD images on the page host, shrink wholesale slide 0, keep GSC settings conservative.
- Non-goals: mass WordPress 301s, return/shipping schema without admin facts, Merchant Center, Validate Fix on healthy exclusions, Cloudflare orange-cloud for `.ir` (DNS still origin `5.75.200.102`; owner action), re-encoding all MinIO originals.

## Live HTTPS (2026-09-03, this session)

| URL | Status | TTFB (Iran Node) | Bytes | Cache | Notes |
|---|---:|---:|---:|---|---|
| `https://www.poshaktaranom.ir/` | 200 | 1.6 s | 189 KB | `s-maxage=60` ISR STALE | LCP preload mobile+desktop hero WebP. 24 imgs, 68 scripts. No wholesale leak. |
| `https://poshaktaranom.ir/` | 301 → www | 1.1 s | 169 | — | One hop. Keep. |
| `https://poshaktaranom.com/` | 200 | 1.6 s | 248 KB | ISR STALE, CF EXPIRED | 10 imgs, **99 scripts**. Logo **and** hero both preloaded. |
| VPS public www.ir | 200 | 196 ms | 188 KB | — | Origin is fine; Iran path + uncached LCP is the mobile problem. |
| VPS public .com | 200 | 229 ms | 248 KB | — | |
| `/robots.txt` .ir | 200 | 247 ms | 288 | `max-age=0` | Our rules + sitemap. |
| `/robots.txt` .com | 200 | 459 ms | 2121 | `max-age=0`, CF EXPIRED | Cloudflare **Managed content / Content-Signal** prepended; our rules still at the bottom. Googlebot remains `Allow: /`. |
| Sitemap index both | 200 | ~0.2–0.3 s | — | 1 h | pages/products/categories/blog. |
| Retail blog.xml | 200 | — | 5 URLs | — | Includes the two posts that were missing on 08-31. |
| Sara image `.ir` and `.com` `/media/...jpg` | 200 | — | **3,679,762** | 30 d | Merchant/PDP LCP risk. |

Sitemaps today: retail 8 pages + 60 products + 10 cats + 5 blog; wholesale 13 + 58 + 10 + 3.

## GSC UI (2026-08-31, not refreshed in UI today)

| Property | Clicks / 3 mo | Impr | Indexed | Not indexed | CWV mobile |
|---|---:|---:|---:|---:|---|
| `.ir` | 109 | 4.4K | 171 | 168 | No CrUX |
| `.com` | 56 | 1.29K | 49 | 116 | **11 poor, LCP > 4s** |

Merchant retail: 27 missing image (last noted 8/30). Do not Validate Fix until this JSON-LD host fix is live.

## Code in this task

- nginx: `^~` for `/_next/static/`, `/fonts/`, `/banners/`; `proxy_hide_header Cache-Control` so origin `max-age=0` cannot leak; `/robots.txt` cached 1 h. Both `.com` and `www.ir` vhosts.
- `next.config.ts`: matching Cache-Control for banners/fonts/logo/og/robots (defense in depth).
- Wholesale `Header`: `fetchPriority="low"` + width/height so the 48 px logo is not the LCP candidate.
- `absoluteJsonLdUrl`: rebase Taranom hosts (`.com` / `.ir` / api / storage) onto the page channel origin. Spec added.
- Wholesale LCP assets: `wholesale-01-mobile.webp` 86 KB → **38 KB**; `wholesale-01.webp` 97 KB → **60 KB**.

## GSC settings — keep / do / don’t

Already correct (08-31, leave as-is):

- Domain properties verified; HTTPS clean; no manual actions.
- GA4 linked to both properties.
- Apex `.ir` sitemap Success kept.
- Search generative AI = Include (retail).
- Crawl rate default.

Do after this deploy (owner in the logged-in GSC tab):

1. Recheck `https://www.poshaktaranom.ir/sitemap.xml`. If it is Success, keep both apex and www rows. If www is still “Couldn't fetch”, keep apex Success and do not delete it.
2. URL Inspection of `https://www.poshaktaranom.ir/` and `https://poshaktaranom.com/` only if they are 200 self-canonical (they are). Request indexing **once** after deploy, not for `/account` or 301 sources.
3. After Google recrawls a money PDP, Validate Fix **Missing field image** only. Wait 28 days before Validate Fix on CWV.
4. In Cloudflare `.com`: AI Crawl Control / managed robots prepend is why wholesale `robots.txt` is 2.1 KB. Optional: stop prepending Content-Signals; our Allow/Disallow already allow Google.
5. Orange-cloud `www.poshaktaranom.ir` (Full strict) is still the TTFB move for Iran. DNS is origin-only today.
6. Rename GA4 stream `Retail - poshaktaranom.com` → Wholesale (Analytics Admin; not GSC).

Do **not**:

- Validate Fix Page with redirect / Excluded by noindex / Not found.
- Request indexing for `/shop/`, `/wholesale/` on `.ir`, HTTP URLs, `/_next`, fonts.
- Change of address.
- Add `hasMerchantReturnPolicy` / `shippingDetails` until return and shipping days exist in admin.

## Owner leftovers (not this diff)

- Recompress existing MinIO JPEGs (Sara 3.7 MB). Upload pipeline already converts new files to 1200×1600 WebP; old objects were stored as-is when sharp threw.
- Retail CrUX still empty: not enough eligible Chrome users, plus some Windows/Schannel clients fail TLS on www (Node/VPS do not). Orange-cloud may also help reachability.
- Wholesale home HTML 248 KB / 99 scripts: next speed slice after this cache/LCP deploy.

## Validation

- `npx tsx apps/web/src/lib/jsonld-url.spec.ts` → `jsonld-url.spec.ts ok`
- Live probes recorded above
- nginx `-t` and storefront TTFB after deploy: see handoff
