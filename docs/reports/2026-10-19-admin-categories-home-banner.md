# Admin categories: home visibility + square banner + UX

Date: 2026-10-19 · Task: TASK-20261019-001 · Depth: skill-top full

## Problem

- Checkbox «نمایش در صفحه اول» looked off in admin, but categories still appeared on storefront home.
- Root cause: after 2026-10-18 wholesale home intentionally listed **all ACTIVE** categories and ignored `showOnHome`. Retail already filtered. Label said «صفحه اول» without channel scope.
- Secondary: toggle only applied after «ذخیره»; easy to uncheck and leave without saving.
- Banner upload reused the product 3:4 Sharp pipeline instead of 1:1.

## Fix

1. `WholesaleCategoryIndex` (CMS home `categoryBanners`) passes `homeOnly: true`. Nav and `/products` still omit `homeOnly`.
2. Admin toggle for `showOnHome` / `isIndexable` PATCHes immediately and revalidates retail+wholesale home.
3. Upload profile `categoryBanner`: client center-crop prepare + server Sharp cover 1200×1200 WebP under `categories/`.
4. Admin UI: search, home filter chips, compact banner dropzone, clearer copy, SEO accordion unchanged in capability.

## SEO / GEO notes

- Indexability toggle unchanged; menus/nav keep discovery of ACTIVE categories.
- Home merchandising only; category landing URLs and sitemap policy untouched.
- Smaller square WebP helps LCP on category grids (cap still 12–16 retail / 24 wholesale ceiling).

## Research / skills

- Repos: Kris1027 react-ecommerce-admin (toggle + image), Sodai category admin PR (status toggle).
- Image: Sharp re-encode + `limitInputPixels` (existing project pattern).
- 21st: searched editable tables; AI generation off — built with project admin tokens.

## Verify

- `npx ts-node --transpile-only src/modules/upload/image-processor.spec.ts` → ok
- `npx tsx src/lib/catalog/category-storefront.spec.mts` → OK
- `apps/web` `tsc --noEmit` → 0
