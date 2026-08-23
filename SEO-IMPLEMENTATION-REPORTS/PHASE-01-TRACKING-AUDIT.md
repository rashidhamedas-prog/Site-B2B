# PHASE-01 TRACKING AUDIT

Project: poshaktaranom.ir (retail)  
Date: 2026-08-22  
Git checkpoint: `bbd8181` (`chore/TASK-20260822-001-remove-debug-ingest`)  
Task: TASK-20260822-005

## Entry points found

| File | Component / function | Host / channel | Runs in admin? | Runs in development? | GTM + direct gtag? | Duplicate page_view possible? | SPA navigation | Ecommerce present | Ecommerce missing (before this phase) |
|------|----------------------|----------------|----------------|----------------------|--------------------|-------------------------------|----------------|-------------------|----------------------------------------|
| `apps/web/src/app/layout.tsx` | `DeferredGtm` + `GtmBodyNoscript` via `resolveGtmIdForHost` | Host-based: `.ir` → `GTM-NKBCGQJV`, `.com` → `GTM-M3LQFGZV`. Defaults always applied on production hosts. | **Yes (before).** GTM keyed off host only, so `/admin/*` on `.ir` received retail GTM. | **Yes (before).** `localhost` resolved to wholesale default GTM. | GTM container only here | If GTM Google Tag has All Pages, yes | GTM history-change depends on container config (not in repo) | none | n/a |
| `apps/web/src/components/shared/DeferredGtm.tsx` | `DeferredGtm` | Same as layout | **Yes (before)** | **Yes (before)** | GTM | Initial `gtm.js` + GA4 tag in container | no | none | n/a |
| `apps/web/src/components/shared/GoogleTagManager.tsx` | `resolveGtmIdForHost`, `GtmHeadScript`, `GtmBodyNoscript` | Host-based defaults | noscript iframe on every host including admin | yes on localhost (before) | GTM | noscript extra hit if JS off | no | none | n/a |
| `apps/web/src/app/retail/layout.tsx` | `GoogleAnalyticsProvider` | Retail tree only (public `.ir` rewrite + `/retail` preview) | No (admin is a different layout) | Yes if layout rendered | Direct `gtag.js` **and** previously also `loadGtm()` | **Yes (before):** GTM All Pages + `gtag('event','page_view')` | Yes, `usePathname` | none | n/a |
| `apps/web/src/components/shared/GoogleAnalytics.tsx` | `GoogleAnalytics`, `loadGtag`, `loadGtm` (removed) | Channel prop RETAIL / WHOLESALE | Not mounted on `/admin`, but `page_path` used Next internal path | Loaded if component mounted | **Both (before):** `loadGtm` + `loadGtag` | **Yes.** First effect + path effect were deduped by `lastSent`, but GTM still sent a separate page_view | Yes | none | all ecommerce |
| `apps/web/src/app/(wholesale)/layout.tsx` | `GoogleAnalyticsProvider channel=WHOLESALE` | `.com` | No | Yes if mounted | Direct gtag | Same pattern on wholesale | Yes | none | out of scope |
| `apps/web/src/components/retail/RetailPixels.tsx` | Meta / Yektanet / Adro / Affer / Afsona / Takhfifan | Retail layout | No | Idle-deferred if layout mounts | No GA4 | Meta PageView only | no | none (pixels) | n/a |
| `apps/web/src/components/retail/RetailConversion.tsx` | purchase pixels + `gtag('event','purchase')` | Thank-you + `/payment/callback` | No | If page opened | gtag if already loaded | Purchase could double with GTM event tag on `purchase` | n/a | `purchase` (wrong unit, thin items, no dedup) | view_item, cart, checkout |
| `apps/web/src/app/retail/checkout/page.tsx` | mounts `RetailConversion` after COD success | Retail | No | Yes | via conversion | n/a | n/a | COD `purchase` only | begin_checkout, shipping, payment, stash for ONLINE |
| `apps/web/src/app/payment/callback/page.tsx` | mounts `RetailConversion` after verify `ok` | Both channels; retail callback is `.ir` | No | If opened | via conversion | Refresh could re-fire (before) | n/a | `purchase` after verify | items (callback does not pass line items) |
| `apps/web/src/components/blog/BlogAnalyticsTracker.tsx` | blog `view_item` / scroll | Blog surfaces | No | If blog viewed | gtag | Unrelated content `view_item` | n/a | blog `view_item` (content, not product) | not product ecommerce |
| `apps/web/src/components/blog/BlogCtaTags.tsx` | `blog_*_click` | Blog | No | If blog viewed | gtag | no | n/a | none | n/a |
| `apps/web/src/components/shared/WebVitalsReporter.tsx` | LCP/CLS/INP → gtag | Next to GA provider | No | If provider mounts | gtag | no | n/a | none | n/a |
| `apps/web/src/lib/google.ts` | ID sanitizers / env | both | n/a | n/a | n/a | n/a | n/a | n/a | n/a |
| `apps/web/src/lib/google-seo.ts` | GSC verification meta | both | GSC meta is not GA4 | yes | no | no | n/a | none | n/a |

`sendGAEvent` is **not** used in this codebase.

## Duplicate GA4 page_view (before)

**Yes.** Two loaders on public retail:

1. Root `DeferredGtm` → container `GTM-NKBCGQJV`. `docs/GOOGLE-SETUP.md` instructs a Google Tag (GA4 `G-F2V7VSJMLE`) with **All Pages**.
2. `GoogleAnalytics` loads `gtag/js?id=G-…` with `send_page_view: false`, then sends a manual `page_view`.

Those two hits used **different paths**:

- GTM uses `window.location` → public `/products`
- `usePathname()` after middleware rewrite → `/retail/products`

That is why GA4 showed both `/products` and `/retail/products` rather than a clean duplicate of one URL.

`GoogleAnalytics.loadGtm` was a third GTM inject path; it usually no-op’d if `gtm.js?id=` was already present.

## `/retail/*` leakage — root cause

Next.js middleware rewrites `https://www.poshaktaranom.ir/products` → internal `/retail/products`.

- Browser URL (and GTM) stay `/products`
- App Router `usePathname()` returns `/retail/products`
- `GoogleAnalytics.sendPageView` used `usePathname()` as `page_path`

Internal links in storefront already use public paths (`/products`, `/checkout`). This was **not** caused by `<Link href="/retail/products">` on the public site. Do not change routing to fix analytics.

## Admin leakage — root cause

`/admin/blog` and `/admin/login` in retail GA4 came from **root GTM**, not `GoogleAnalyticsProvider` (admin layout does not mount it). `resolveGtmIdForHost('www.poshaktaranom.ir')` returned retail GTM for every path on that host.

## Ecommerce before this phase

Present: incomplete `purchase` in `RetailConversion` (Toman amount labelled `IRR`, SKU-only items, no dedup, no cart events).

Missing: `view_item`, `add_to_cart`, `remove_from_cart`, `view_cart`, `begin_checkout`, `add_shipping_info`, `add_payment_info`, `view_item_list`.

## Currency (verified, not assumed)

| Layer | Unit |
|-------|------|
| Stored price / cart / order / payment | **IRR (Rial)**, bigint. Display helper is `Math.round(n / 10)` Toman. |
| Display | Toman |
| ZarinPal `amount` | IRR (`amountIrr`) |
| Previous GA4 `purchase` | **Wrong:** `amountIrr / 10` sent with `currency: 'IRR'` |

Evidence: `product-display.ts` (“Prices are IRR; UI shows toman”), `docs/reports/2026-08-22-catalog-excel-export.md`, `zarinpal.adapter.ts` `amount: req.amountIrr`.

## Consolidation after this phase

- Production tags: skip localhost / `.local` / preview hosts.
- GTM JS: skip `/admin` and `/admin/*` in `DeferredGtm`.
- Direct gtag: skip admin, skip non-production hosts, skip opposite channel on the other host.
- `GoogleAnalytics` no longer injects GTM (`loadGtm` removed). GTM remains the container loader; gtag remains the app event + SPA `page_view` source with **public** paths.
- Residual: if the live GTM container still has Google Tag **All Pages** with automatic page_view, initial page_view can still double. Owner action: set that tag’s `send_page_view` to false (see manual-actions report). Cannot be fixed from this repo alone.
