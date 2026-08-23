# PHASE-01 CHANGES

Task: TASK-20260822-005  
Checkpoint: `bbd8181`  
Rollback: revert the files below on branch `ai/TASK-20260822-005-ga4-measurement`. No migration, no schema, no SEO/content edits.

## Files

### `apps/web/src/lib/google.ts`
- **Why:** Shared host/path gates and public URL normalization.
- **Old:** IDs only.
- **New:** `isNonProductionAnalyticsHost`, `isAdminAnalyticsPath`, `stripRetailInternalPath`, `sanitizeAnalyticsSearch` (keeps UTM, drops phone/otp/token/etc.), `publicAnalyticsPagePath`, `shouldLoadProductionTags`.
- **Risk:** low

### `apps/web/src/lib/retail-analytics.ts` (new)
- **Why:** One typed source of truth for retail ecommerce events.
- **Old:** n/a
- **New:** IRR helpers, item serialization (`item_brand = Taranom`), `trackViewItem` / cart / checkout / `trackPurchase` with dataLayer + gtag, purchase stash + session/localStorage + in-memory dedup. No-ops when GA unavailable, non-retail host, admin, or local. Never throws.
- **Risk:** low

### `apps/web/src/lib/retail-analytics.spec.ts` (new)
- **Why:** Required unit coverage (gates, items, currency, purchase id, no-op without window).
- **Risk:** none

### `apps/web/src/components/shared/GoogleTagManager.tsx`
- **Why:** Stop shipping production GTM to localhost / preview hosts.
- **Old:** `localhost` got wholesale default `GTM-M3LQFGZV`.
- **New:** `resolveGtmIdForHost` returns `''` on non-production hosts.
- **Risk:** low

### `apps/web/src/components/shared/DeferredGtm.tsx`
- **Why:** Admin must not initialize GTM.
- **Old:** Injected whenever `gtmId` was set (every `.ir` path).
- **New:** Skip `/admin`, `/admin/*`, and non-production hostnames; re-check inside idle callback.
- **Risk:** low. Residual: server-rendered GTM **noscript** iframe can still appear in `/admin` HTML if JS is off (admins use JS). JS GTM does not run on admin.

### `apps/web/src/components/shared/GoogleAnalytics.tsx`
- **Why:** Public paths, no admin/dev, no second GTM inject, no wholesale ID on `.ir`.
- **Old:** `page_path` = `usePathname()` (`/retail/products`); `loadGtm` + `loadGtag`.
- **New:** `page_path` / `page_location` from `window.location` (stripped `/retail` fallback); no `loadGtm`; skip admin, local, and opposite-channel host.
- **Risk:** medium (measurement). SPA page_view still sent; owner should disable GTM automatic page_view.

### `apps/web/src/app/layout.tsx`
- **Why:** Unchanged structure; behavior changes via `resolveGtmIdForHost`.
- **Old / new:** Still renders `DeferredGtm` + noscript. Empty id → no tags on local.
- **Risk:** low

### `apps/web/src/lib/retail-cart.ts`
- **Why:** `add_to_cart` / `remove_from_cart` after the cart mutation succeeds (PDP + claimed product cards).
- **Old:** Silent zustand persist.
- **New:** Fire events with actual qty delta, color, size, IRR unit price.
- **Risk:** low

### `apps/web/src/components/retail/RetailCartDrawer.tsx`
- **Why:** `view_cart` when the drawer actually opens.
- **Old:** none
- **New:** One event per open, not on qty tweaks.
- **Risk:** low

### `apps/web/src/components/retail/RetailPdpAnalytics.tsx` (new)
- **Why:** `view_item` without editing `RetailProductDetail.tsx` (owned by TASK-004).
- **Risk:** low

### `apps/web/src/app/retail/products/[slug]/page.tsx`
- **Why:** Mount `RetailPdpAnalytics`. Stale reclaim from TASK-018 / TASK-006.
- **Old:** JsonLd + `RetailProductDetail` only.
- **New:** Same plus one client tracker.
- **Risk:** low (no canonical/SEO change)

### `apps/web/src/components/retail/RetailProductsCatalog.tsx`
- **Why:** `view_item_list` for page 1 of the catalog (real list UX). `select_item` not added — product cards are claimed by TASK-003.
- **Risk:** low

### `apps/web/src/app/retail/checkout/page.tsx`
- **Why:** `begin_checkout`, `add_shipping_info`, `add_payment_info`, stash line items for the payment callback, richer COD `purchase`.
- **Old:** Conversion only after COD; ONLINE redirect had no item stash.
- **New:** Stash `transactionIds` + IRR value + items in sessionStorage before gateway redirect. Does not send address/phone/notes to GA4.
- **Risk:** medium (checkout is money-adjacent; analytics-only, no payment logic change)

### `apps/web/src/components/retail/RetailConversion.tsx`
- **Why:** Authoritative `purchase` in IRR, items, dedup; drop PII (`click_id`) from dataLayer.
- **Old:** `value = amountIrr/10` with `currency: 'IRR'`; no dedup; SKU stubs.
- **New:** `trackPurchase` with `transaction_id`, IRR `value`, items from props or pending stash. Affiliate pixels still use Toman for their own APIs. `purchase` fires only when this component mounts on success UI (COD thank-you or payment verify `ok`) — not on the pay button.
- **Risk:** medium

### Reports under `SEO-IMPLEMENTATION-REPORTS/`
- Audit, manual GA4 actions, this file, test results.

### Governance
- `.ai-dos/tasks/active.yaml`, `handoff.md`, `status.md`, `docs/WORKLOG.md` — append/register only.

## Not changed (on purpose)

- `RetailProductDetail.tsx` (TASK-004)
- `RetailProductCard.tsx` (TASK-003) — add_to_cart still fires via cart store
- `apps/web/src/middleware.ts` (TASK-001)
- `apps/web/src/app/payment/callback/page.tsx` (TASK-012) — still mounts `RetailConversion` after verify
- Sitemap, redirects, product copy, schema
- No new npm dependency

## Purchase dedup

1. Server/UI success only (`RetailConversion` on COD done or payment `res.ok`).
2. In-memory `Set` (React remount same tab).
3. `sessionStorage` + `localStorage` key `taranom_ga4_purchase:{id}`.
4. Pending ONLINE payload in `sessionStorage` (`taranom_ga4_pending_purchase`) consumed on first successful fire.
