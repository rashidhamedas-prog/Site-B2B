# Category save + home merchandising (2026-09-12)

Task: TASK-20260912-005  
Architecture: `docs/architecture/category-identity-and-home-merch.md`

## Defects

1. Some Persian name edits in `/admin/categories` did not stick (or looked like they didn’t).
2. New category **پاییزی** did not appear on the retail home.

## Live evidence

- 11 ACTIVE categories. پاییزی exists (`Autumn پاییزی`, slug `autumn`, `sortOrder` 0).
- RETAIL home CMS `categoryBanners`: `maxItems: 10`, `categoryIds` empty (not a whitelist).
- Unique indexes on `categories.name` / `slug` included soft-deleted rows (`شومیز`, `کفتان`, `دامن`, `کت و شلوار`, …).

## Fixes

- Partial unique indexes on live rows only; `23505` → Persian 400.
- Home grid: no reverse-then-slice; pin+append; cap 16; CMS seed 10 → 16.
- Storefront label is `name` as saved (no Persian-token split).
- Catalog fetches tagged `catalog`; category CUD revalidates RETAIL+WHOLESALE home.

## Verify

- Specs: category-storefront, category-unique, migration.
- After deploy: `GET /v1/categories` includes پاییزی; `www.poshaktaranom.ir` home HTML includes پاییزی (or `Autumn پاییزی` until the name is cleaned).
