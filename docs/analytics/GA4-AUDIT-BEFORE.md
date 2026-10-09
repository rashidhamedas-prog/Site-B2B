# GA4 audit before the retail fix

Date: 2026-10-10. Channel: retail `www.poshaktaranom.ir` only. Property ID `547378194` (Windsor account name `www.poshaktaranom.ir`). Wholesale account `547352333` was not queried.

## Stack

- Next.js 15.5.19, React 19.2.7, App Router only.
- Retail layout: `apps/web/src/app/retail/layout.tsx` mounts `GoogleAnalyticsProvider`.
- Root layout mounts `DeferredGtm` once. Direct `gtag.js` is not loaded.
- Retail GTM default in code: `GTM-NKBCGQJV`. Wholesale default: `GTM-M3LQFGZV`.
- Measurement ID is not hardcoded. Runtime reads `NEXT_PUBLIC_GA4_RETAIL_ID`, then admin `marketing.ga4RetailId`.

## Live baseline (Windsor, retail property)

| Date | page_view | session_start | scroll | user_engagement |
|---|---:|---:|---:|---:|
| 2026-08-30 | 91 | 18 | 33 | 38 |
| 2026-08-31 | 86 | 26 | 20 | 12 |
| 2026-09-01 | 7 | 19 | 18 | 9 |
| 2026-09-02 | 0 | 18 | 17 | 8 |
| 2026-09-03 to 2026-09-06 | 0 | still present | still present | still present |

2026-10-01 through 2026-10-09: `session_start` 708. No rows for `page_view`, `view_item`, `add_to_cart`, `begin_checkout`, or `purchase`.

`view_item` and `purchase` were also absent in the 2026-08-30 to 2026-09-06 extract.

## Code baseline

- Page view was sent twice in form: a dataLayer object `{event:'page_view'}` and `gtag('event','page_view')`.
- `ensureGtagStub` pushed a rest-parameter **array**. GTM replays an `arguments` object, not that array.
- Ecommerce helpers already existed for view/list/cart/checkout/purchase and pushed both dataLayer and gtag. Purchase dedupe used memory plus sessionStorage and localStorage.
- Prices sent to GA4 are stored IRR with `currency: "IRR"`. UI toman is display-only (`/ 10`).
- No Measurement Protocol API secret env var exists. Purchase is client-only.
- Dev hosts and `/admin` do not load production tags. There is no Consent Mode banner in the analytics path.

## Cause

Page views still arrived on 2026-08-30 and 2026-08-31, after commit `13bf6578` (2026-08-23) removed direct `gtag.js`. So the array stub alone did not zero `page_view` while something in GTM was still accepting the object-form event.

There is no analytics-file commit on 2026-09-01. That day is a large API/web deploy day (`1ffe3bb9` and later merges). `9cadd9d4` (2026-09-06) only changed DeferredGtm timing and is **after** the cliff.

**Hypothesis, not a git proof:** around 2026-09-01 the GTM mapping that turned the custom `page_view` into a GA4 hit stopped, while the Google tag itself kept sending `session_start`, `scroll`, and `user_engagement`. Ecommerce stayed at zero because those events depended on the same non-replayed gtag queue and had no working GA4 event tag.

A browser network baseline of `g/collect` was not captured in this session. The Windsor extract is the before evidence.
