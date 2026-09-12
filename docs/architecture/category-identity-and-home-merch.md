# Category identity, unique names, and home merchandising

Date: 2026-09-12  
Task: TASK-20260912-005  
Status: Accepted for implementation  
Channels: retail `poshaktaranom.ir`, wholesale `poshaktaranom.com`

This document is the implementation-ready architecture for two operator defects that looked unrelated: **Persian name edits that do not stick**, and **a new ACTIVE category (پاییزی) missing from the storefront**.

## 1. Confirmed facts (live DB + CMS, 2026-09-12)

| Fact | Evidence |
| --- | --- |
| 11 ACTIVE live categories | `categories` where `deletedAt IS NULL` and `status = 'ACTIVE'` |
| پاییزی exists | id `1acdaf14-…`, `name = 'Autumn پاییزی'`, slug `autumn`, ACTIVE, `sortOrder = 0`, created 2026-09-07 |
| RETAIL home `categoryBanners` | `maxItems: 10`, `categoryIds: ''` (auto, not a whitelist) |
| Unique indexes include tombstones | `IDX_categories_name_unique` and `UQ_categories_slug` on **all** rows |
| Soft-deleted Persian names still occupy uniqueness | e.g. deleted `شومیز`, `کفتان`, `دامن`, `کت و شلوار` |

Public `GET /v1/categories` orders `sortOrder ASC, createdAt DESC`, so پاییزی is **first**.

## 2. Root causes (not symptoms)

### RC1 — Home grid reversed newest categories into the slice-off zone

`RetailCategoryBannerGrid` treated API newest-first as “too new”, `[...list].reverse()`, then sliced `maxItems`. Renderer also hard-capped `Math.min(maxItems, 10)`.

With 11 ACTIVE rows and CMS `maxItems: 10`, پاییزی became last and was dropped. Assumption **A4** in `catalog-locale-page-heroes.md` (silent `categoryIds` whitelist) is **false** on current production; the drop is order + cap.

### RC2 — Display unique on `name` includes soft-deleted rows

Cleaning a leftover English prefix (`blouses شومیز` → `شومیز`) collides with a tombstone. TypeORM raises `23505`; Nest returns 500; admin `catch` shows a generic error (easy to miss) and the field looks unchanged after refresh. Categories whose new Persian name does **not** collide appear to “work”.

### RC3 — Storefront label was a Persian-token split, not the `name` column

`displayName` / `labelOf` kept only tokens in `\u0600-\u06FF`. Saving `Autumn پاییزی` still rendered `پاییزی`. Saving a change that only removed Latin tokens looked like a no-op on the site even when the row updated.

### RC4 — Category CUD never busts catalog ISR

Home/category fetches used `{ next: { revalidate: 300 } }` **without** `tags: ['catalog']`. CMS revalidate already knows the `catalog` tag; category admin never called it. Name edits therefore lagged up to five minutes, which matches “some applied, some didn’t” across two browser checks.

## 3. Decisions

| Decision | Choice | Why |
| --- | --- | --- |
| D1 Identity | `name` = Persian storefront label (required). `nameEn` = English label + preferred slug source. `slug` = URL identity. | Same split as TASK-20260912-002; do not put English inside `name`. |
| D2 Uniqueness | Partial unique `(name) WHERE deletedAt IS NULL` and `(slug) WHERE deletedAt IS NULL`. | Tombstones must not block a live Persian rename. Two **live** rows still cannot share a label or URL. |
| D3 Unique errors | Map Postgres `23505` to HTTP 400 with a Persian message. | Operators need a field-level reason, not a 500. |
| D4 Home auto merch | Empty `categoryIds` = all ACTIVE, API order (`sortOrder`, then newest). CMS pins first when ids are set, then the rest. **Never reverse-then-slice.** | New categories must appear without a curated UUID. |
| D5 Cap | Performance-first ceiling **16** category **cards** on home. CMS `maxItems` is `1…16` (legacy seed `10` bumped to `16`). | 12–16 is the landing-card budget; 10 was a code default that hid the 11th category. |
| D6 Label | Storefront prints `name` (fallback `nameEn`). No token splitting. | What the operator saved is what shoppers see. |
| D7 Cache | Public category fetches use `tags: ['catalog']` and `revalidate: 60`. Category CUD calls existing `/admin/cms/revalidate` for RETAIL+WHOLESALE `home` (already includes tag `catalog`). | Same invalidation path as CMS; no new service. |
| D8 Slug on rename | Do not auto-rewrite slug when only `name` changes. | Existing `/category/{slug}` URLs stay stable; operator can edit slug and get the existing 301. |

### Non-goals

- Channel-split category tables.
- Website builder / extra CMS block types.
- Auto-translating leftover mixed names (`blouses شومیز`) in a data migration (operator can clean them once unique-on-tombstone is gone).
- Raising home product grids; this cap is **category cards** only.

## 4. Trust / rollback

- Auth unchanged: category CUD stays JWT ADMIN.
- Migration is additive: drop full unique, create partial unique. Down recreates full unique **only if** no live/tombstone name or slug collision exists; otherwise down must fail closed.
- Independent Security: schema uniqueness change (review trigger `database_migration`). No secrets, no public write widening.

## 5. Acceptance

| Journey | Pass |
| --- | --- |
| Rename `blouses شومیز` → `شومیز` | 200; row `name` is `شومیز`; home label is `شومیز` after revalidate |
| Create ACTIVE `پاییزی` (or existing autumn row) | Appears on retail home grid and shortcut pills without pinning its id |
| Two live rows with the same Persian name | 400 «این نام فارسی…» |
| Home with 11 ACTIVE categories | All 11 cards render (≤16) |
| Inner CMS pages | Unchanged (no new home campaign leak) |
