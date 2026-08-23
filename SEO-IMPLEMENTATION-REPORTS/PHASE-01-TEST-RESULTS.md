# PHASE-01 TEST RESULTS

Date: 2026-08-22  
Branch: `ai/TASK-20260822-005-ga4-measurement`  
Checkpoint: `bbd8181`

```
Lint:
  apps/web `npx tsc --noEmit` (package lint script) — exit 0 (~39s)

Typecheck:
  apps/web `npx tsc --noEmit` — exit 0

Build:
  apps/web `npx next build` — exit 0 (~113s compile, 73/73 pages)

Automated tests:
  From apps/api:
  $env:TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","moduleResolution":"node"}'
  npx ts-node --transpile-only --skip-project ../web/src/lib/retail-analytics.spec.ts
  → `retail-analytics.spec.ts ok` exit 0
  Covers: helper no-op without window, item serialization, IRR identity, add_to_cart payload shape, purchase payload + transaction_id, admin/local gates, /retail → /products, UTM kept / phone stripped, retail vs wholesale host.

Admin tracking:
  Code: `isAdminAnalyticsPath('/admin/login')` true; `shouldLoadProductionTags(www.poshaktaranom.ir, /admin/login)` false; `DeferredGtm` returns before inject on `/admin`.
  Live GA4 Realtime after deploy: NOT RUN (no deploy this phase).

Public page tracking:
  `GoogleAnalytics` sends `page_path` from `window.location` via `publicAnalyticsPagePath`. Live Realtime: NOT RUN.

Retail path normalization:
  `stripRetailInternalPath('/retail/products') === '/products'` — spec OK.
  `publicAnalyticsPagePath('/retail/products', 'utm_source=google&phone=0912') === '/products?utm_source=google'` — spec OK.

view_item:
  Implemented: `RetailPdpAnalytics` on PDP, once per product id. Unit: item helper. Browser: NOT RUN.

add_to_cart:
  Implemented: `retail-cart.addItem` after mutation (PDP + catalog cards). Spec payload OK. Browser: NOT RUN.

begin_checkout:
  Implemented: retail checkout mount when cart has items. Browser: NOT RUN.

purchase:
  Implemented: `RetailConversion` on COD thank-you and payment verify success; ONLINE items from session stash. Value = stored IRR. Browser / live order: NOT RUN.

Purchase dedup:
  In-memory Set + sessionStorage + localStorage `taranom_ga4_purchase:{id}`. Spec: second `hasPurchaseBeenFired` is true.

PII check:
  Query sanitizer drops phone/otp/token/email/address/recipient. Purchase dataLayer no longer includes `click_id`. Notes/address/mobile are not in GA4 payloads. Spec checks phone stripped from page_path.
```

Live GA4 Realtime and a real `purchase` in the production property are **not** claimed. They need a production deploy plus the owner’s GTM `send_page_view=false` step.
