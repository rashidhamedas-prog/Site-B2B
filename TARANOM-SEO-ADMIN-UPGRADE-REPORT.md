# Taranom SEO + Admin upgrade — implementer report

**Task:** TASK-20260817-001  
**Lane:** storefront / schema / merchant feed / audit (this implementer)  
**Date:** 2026-08-17  
**Branch:** `ai/TASK-20260817-001-seo-admin-upgrade`

This report covers only the files this implementer was allowed to change. Admin products/categories, category entity, middleware, sitemap, and About were **not** edited here.

## Landed in this lane

| Item | Status | Where |
| --- | --- | --- |
| Wholesale card: remove MOQ + stock boxes; keep colors + sizeTypeLabel | Done | `WholesaleProductCard.tsx` |
| Public min-order copy 5 → «حداقل سفارش در محصول از 6 عدد به بالا می باشد.» | Done in FAQ default + header fallback | `WholesaleFaq.tsx`, `Header.tsx` |
| Home page min-order-5 copy | Not present — no edit | `(wholesale)/page.tsx` |
| Theme settings min-order-5 copy | Not present — no edit | `theme-settings.ts` |
| Retail Product schema `@id` `#product`, Offer.price = `sale.payable` IRR, NewCondition, brand پوشاک ترنم | Done | `JsonLd.tsx`, retail PDP |
| ProductGroup + hasVariant (no extra URLs) when color/size vary | Done | `JsonLd.tsx`, retail PDP |
| Wholesale Offer: no public price | Done (`includePrice={false}`) | wholesale PDP |
| Related products H2 + real href via `getProductCanonicalPath`; fallback `relatedTo` | Done | retail detail + wholesale PDP |
| Retail sale badge from `sale.badgePercent` / compare-at; expired sale hides badge | Done | `RetailProductCard.tsx`, `RetailProductDetail.tsx` |
| Dual content `fullContent` on retail PDP | Done | `RetailProductDetail.tsx` |
| Google Merchant RSS/XML retail-only | Done | `GET /v1/feeds/google-merchant.xml` |
| Web proxy | Done | `apps/web/src/app/feeds/google-merchant.xml/route.ts` |
| `seo:audit` script | Done | `scripts/seo-audit.mjs` + root `package.json` |
| Redirect map / QA checklist | Done | root CSV + MD |

## Remaining (honest)

- **Admin UI** (discount window, related picker, dual content, category SEO): landed in parallel; follow-up now applies sale prices on product save.
- **Category public URL `/category/{slug}` + UUID redirect + sitemap index:** landed; helpers live in `apps/web/src/lib/sitemap-xml.ts`.
- **About + Mashhad local landing:** landed by storefront lane.
- **CMS defaults:** announcement/FAQ copy in `defaults.ts` updated to ۶. Live header still comes from CMS/DB — if that row still says ۵, update it in admin.
- **Retail host `/feeds/google-merchant.xml`:** `/feeds` and `/sitemaps` are now in `isChannelExemptPath`. Not live until deploy.
- **Live `seo:audit`:** script is written. A live run may be SKIPPED/FAIL if this environment cannot reach the public sites. Do not treat an un-run crawl as PASS.
- **Independent Reviewer + Security:** not run. Task is not Done.

## Rollback

1. Revert application code on this branch (or revert the merge commit).
2. Database: revert migration **`SeoAdminUpgrade1755410400001`** (`down()` in `apps/api/src/database/migrations/20260817-001-seo-admin-upgrade.ts`). Do not enable TypeORM `synchronize`.
3. If the merchant feed was registered in Google Merchant Center, remove or pause that feed URL after rollback.

## Validation in this lane

| Command | Result |
| --- | --- |
| `node scripts/seo-audit.mjs --skip-live` | exit **1** — live HTML **SKIPPED** (flag); both public sitemaps **PASS** (no query `loc`); live Google Merchant **FAIL** 404 (endpoint not deployed yet). Wrote `reports/seo-audit.md` + `reports/seo-audit.json`. |
| `npx tsc --noEmit -p apps/web/tsconfig.json` | exit **0** |
| `cd apps/api && npx tsc --noEmit` | exit **0** after orchestrator follow-up (`attachRelated` constraint dropped) |
| Full `npm run lint` / `npm run test` / `npm run build` | **NOT RUN** in this lane |

Do not treat the skipped live crawl as PASS. Rollback: revert migration `SeoAdminUpgrade1755410400001`.
