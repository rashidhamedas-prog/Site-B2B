# Rollback

The measurement change is limited to the web app. No migration was added. No env secret was written.

## Revert

Restore these files from the parent commit:

- `apps/web/src/lib/google.ts`
- `apps/web/src/lib/retail-analytics.ts`
- `apps/web/src/lib/retail-analytics.spec.ts`
- `apps/web/src/lib/retail-wishlist.ts`
- `apps/web/src/components/shared/GoogleAnalytics.tsx`
- `apps/web/src/components/sales-partners/SalesPartnerCatalog.tsx`

Docs under `docs/analytics/` can stay. They do not affect runtime.

## After revert

GTM still loads. `page_view` returns to the previous behavior (zero in GA4 since 2026-09-02). Cart, checkout, and payment code were not changed.

Do not delete the GA4 property or the GTM container as a rollback. Panel unwanted-referral and key-event edits, if someone makes them later, are separate and should be undone in the GA4 admin UI.
