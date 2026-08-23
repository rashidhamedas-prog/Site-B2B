# PHASE-02B ROLLBACK

Date: 2026-08-23  
**Database migration: NONE**

No production deploy was performed. Rollback of production is N/A until a release ships these files.

Local/git rollback: restore the listed files from `1f9d9bf` (or `git checkout -- <file>` for tracked files). Keep Phase 01 dirty diffs if that work should survive.

---

| File | Change | Rollback | Risk |
|------|--------|----------|------|
| `apps/web/src/lib/cms/fetch.ts` | SSR CMS uses `getServerApiBase()` | Restore `NEXT_PUBLIC_API_URL` constant | Home/chrome SSR hops public API again |
| `apps/web/src/lib/server-api-base.ts` | New helper (no `cache()` import) | Delete file; inline old `getServerApiBase` in `server-api.ts` | Import errors if other files still point here |
| `apps/web/src/lib/server-api.ts` | `fetchPublicSettings`, `slimRetailCatalogProduct`, re-export base | Restore previous file | Duplicate settings fetches; fat catalog payload |
| `apps/web/src/lib/google-seo.ts` | Channel-aware GSC; root tokens without `headers()` | Restore previous `fetchMarketing` + `headers()` | Home HTML `no-store` returns |
| `apps/web/src/app/layout.tsx` | No `headers()`; `revalidate = 60`; DeferredGtm self-host | Restore headers + GtmBodyNoscript | ISR lost; duplicate GSC/GTM host logic |
| `apps/web/src/app/retail/layout.tsx` | Shared `fetchPublicSettings` | Restore local fetch helper | Extra settings request |
| `apps/web/src/app/retail/page.tsx` | `revalidate = 60`, `dynamic = 'force-static'` | Remove those exports | Home dynamic again |
| `apps/web/src/app/(wholesale)/layout.tsx` | Wholesale GSC `generateMetadata` | Remove `generateMetadata` | Wholesale GSC relies on root env/DB tokens only |
| `apps/web/src/components/retail/RetailHero.tsx` | Static WebP LCP + preload | Restore `next/image` `fill`+`priority` picture | Empty preload / JPEG optimizer path |
| `apps/web/src/components/shared/HeroCarousel.tsx` | `waitForIdle` autoplay | Restore interval-only autoplay | Early LCP slide swap |
| `apps/web/next.config.ts` | `minimumCacheTTL: 86400` | Remove key | Optimizer `max-age=60` |
| `apps/web/src/app/retail/products/page.tsx` | Slim SSR + page SSR | Restore full objects / page-as-filter | Larger HTML |
| `apps/web/src/components/retail/RetailProductsCatalog.tsx` | Crawlable pagination | Restore load-more-only (keep Phase 01 `trackViewItemList`) | Weaker crawl of page 2+ |
| `apps/web/src/components/retail/RetailProductCard.tsx` | lazy + no compact hover image | Restore previous Image props | Extra home image |
| `apps/web/src/lib/google.ts` | `ensureGtagStub` | Remove function + callers | gtag events drop if GTM-only |
| `apps/web/src/components/shared/GoogleAnalytics.tsx` | No `gtag.js` / no `useSearchParams` | Restore Phase 01 `loadGtag` (do not restore pre-Phase-01 `loadGtm`) | Duplicate GA4 loader; layout dynamic |
| `apps/web/src/components/shared/DeferredGtm.tsx` | Optional `gtmId`, client host resolve | Restore required `gtmId` from root `headers()` | Conflicts with static root layout |
| `apps/web/src/components/shared/GoogleAnalyticsProvider.tsx` | Comment only | Restore previous comment | none |
| `apps/web/src/components/shared/WebVitalsReporter.tsx` | stub before gtag | Restore gtag-only guard | RUM dropped until GTM defines gtag |
| `apps/web/src/lib/retail-analytics.ts` | stub in `gtagEvent` | Restore gtag-if-present | Ecommerce missed if gtag.js gone |
| `apps/web/src/components/blog/BlogAnalyticsTracker.tsx` | stub | Restore gtag-if-present | Blog events missed |
| `apps/web/src/components/blog/BlogCtaTags.tsx` | stub | Restore previous | Blog CTA events missed |
| `SEO-IMPLEMENTATION-REPORTS/PHASE-02B-*.md` | Reports | Delete these five files | none |

Tracked Phase 01 files this phase did **not** intend to revert: checkout, PDP analytics mount, cart drawer, conversion, `retail-cart.ts`, `GoogleTagManager.tsx`.

Exact revert of **only** Phase 02B is not a single commit (mixed dirty tree). Prefer file-by-file restore from the table, or a dedicated commit before deploy.
