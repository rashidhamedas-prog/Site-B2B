# Category `showOnHome` — retail home grid only

Date: 2026-10-07  
Task: TASK-20261007-002  
Status: Live on VPS tip `8d7c752` (feature commit `abeefa7b`). Health 200. Public categories include `showOnHome`. Admin checkbox is in the web image.

## Goal

Operators can hide a category tile from the retail homepage grid without affecting menus, category pages, SEO, or the rest of the catalog.

## Architecture

| Layer | Change |
| --- | --- |
| DB | `categories.showOnHome boolean NOT NULL DEFAULT true` (expand-only) |
| Entity / service | Persist on create/update; default visible |
| Admin | Checkbox «نمایش در صفحه اول» next to `isIndexable` |
| Home merch | `merchandiseCategories(..., { homeOnly: true })` in `RetailCategoryBannerGrid` and `BoutiqueCategoryRow` only |
| Nav / SEO | Unchanged — no `homeOnly` on `retail/layout` mega-nav or sitemap |

**Non-goals:** do not reuse `status: HIDDEN` or `isIndexable` for this.

## Validation

- `npx ts-node --transpile-only src/database/migrations/20261007-001-category-show-on-home.spec.ts`
- `node --experimental-strip-types` (or project runner) on `category-storefront.spec.mts`

## Rollback

Forward migration to drop `showOnHome`, or leave column and set all rows `true`.
