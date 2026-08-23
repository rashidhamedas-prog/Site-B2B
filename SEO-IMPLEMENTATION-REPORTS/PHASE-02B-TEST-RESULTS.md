# PHASE-02B TEST RESULTS

Date: 2026-08-23

---

## Build gate

| Check | Result |
|-------|--------|
| `apps/web` `tsc --noEmit` | **PASSED** |
| `npm run build` (`apps/web`) | **PASSED** (Next 15.5.19). `/retail` is `○` static, revalidate 1m. `/retail/checkout`, `/retail/account`, `/retail/products/[slug]` remain `ƒ`. |
| Root `turbo lint` | **NOT_RUN** (web `lint` script is `tsc --noEmit`, already passed) |
| `retail-analytics.spec.ts` | **PASSED** (`ts-node --transpile-only --skip-project` from `apps/api`, CJS compiler options) |

---

## SEO regression (production HTML, code canonicals unchanged)

| URL | HTTP | Canonical | `/retail` leak | Title | Description | JSON-LD | H1 |
|-----|------|-----------|----------------|-------|-------------|---------|-----|
| `https://www.poshaktaranom.ir/` | 200 | `https://www.poshaktaranom.ir` | no | present | present | present | present |
| `/products` | 200 | `…/products` | no | present | present | present | present |
| `/category/shomiz` | 200 | `…/category/shomiz` | no | present | present | present | present |
| `/products/linen-shirt-manteau-golrokh` | 200 | self | no | present | present | present | present |
| `/blog/trendy-womens-shirt-1405` | 200 | self | no | present | present | present | present |
| `/sitemap.xml` | 200 | n/a | n/a | n/a | n/a | n/a | n/a |
| `/robots.txt` | 200 | n/a | n/a | n/a | n/a | n/a | n/a |
| `/this-page-does-not-exist-p02b` | **404** | n/a | n/a | n/a | n/a | n/a | n/a |

Note: PHASE-02 PDP slug `golrokh-linen-shirt-dress` is no longer the sitemap canonical (`linen-shirt-manteau-golrokh`). Curl still returns HTTP 200 with a ~34 KB streamed shell; rendered title is the 404 page. That is pre-existing slug canonicalization, not a Phase 02B URL change.

**SEO regression: PASSED** (no canonical/`/retail` leakage introduced; sitemap/robots/404 OK). Live HTML is still the unpatched production build.

---

## Analytics / ecommerce

| Check | Result |
|-------|--------|
| `trackAddToCart` / `trackPurchase` / `toGa4Item` unit spec | PASSED |
| Direct `gtag.js` loader removed | YES (code) |
| Events still go `dataLayer` + `gtag` stub | YES |
| `view_item` / `add_to_cart` / `view_cart` / `begin_checkout` / `purchase` helpers | still exported from `retail-analytics.ts` |
| Live purchase | **NOT_RUN** (no order) |

**Analytics regression (compile/unit): PASSED**

---

## Settings fetch count (Home, code)

| | Before | After |
|--|--------|-------|
| Distinct server settings URLs | public `/settings/public` (GSC) + internal `?channel=RETAIL` (layout) | unified `fetchPublicSettings('RETAIL')` + env GSC skip |
| `headers()` on Home | yes (root layout) | no |

---

## Local ISR smoke

Three Home curls to `127.0.0.1:3010` with retail Host: 200, `x-nextjs-cache: HIT`, `s-maxage=60`. Checkout/account routes still listed dynamic in the build manifest.
