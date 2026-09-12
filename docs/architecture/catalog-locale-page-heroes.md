# Catalog membership, locale presentation, and page-scoped heroes

Date: 2026-09-12  
Task: TASK-20260912-002  
Status: Accepted for implementation (phased)  
Channels: wholesale `poshaktaranom.com`, retail `poshaktaranom.ir`

This document is the implementation-ready architecture for three defects that share one cause: **storefront presentation mixed identity, locale, and merchandising into the same strings and the same hero component**.

## 1. Goals, non-goals, assumptions

### Confirmed outcome

Operators can manage catalog and CMS in Persian without English-in-the-name workarounds. A product can belong to one or many categories. Visible numbers follow the UI language. Each public page owns its own banner. The same mistakes cannot recur by dropping home campaign plates into every `hero` block.

### Success criteria (observable)

| Journey | Pass |
| --- | --- |
| Admin creates category with Persian `name` only (spaces allowed) | Row exists; ASCII `slug` is generated; category appears on home grid without a curated ID |
| Admin sets Persian `name` + English `nameEn` | Storefront label is Persian in `fa`; URL uses `nameEn`-based slug |
| Product assigned to categories A (primary) + B | Category A and B listings both include it; SKU still comes from A |
| CMS stats value typed as `12` or `۱۲` | `fa` storefront shows `۱۲`; `en` storefront shows `12`; stored JSON stays Latin digits |
| `/about`, `/wholesale`, `/contact`, `/blog` on `.com` and `.ir` | Do not render home campaign plates; H1 is that page’s title |
| Home `.com` / `.ir` | Current campaign injection and LCP slide 0 unchanged |

### Non-goals

- Website builder, page builder, or a second CMS.
- Splitting categories by channel (RETAIL/WHOLESALE stay product flags, not category rows).
- Full English storefront copy in this program. Locale infrastructure is built so digits/dir/labels can switch; English marketing pages are a later content project.
- Changing Torob/Basalam category taxonomies beyond sending primary + additional memberships when those adapters already accept extra categories.
- Rewriting wholesale `/about` 3D experience in this task (it currently bypasses CMS). It still must not import home heroes.

### Assumptions (labeled)

- **A1:** Storefront language today is `fa` (`lang=fa_IR`, RTL). An `en` switch is not live; digit policy must still not bake Persian numerals into stored CMS JSON.
- **A2:** Operators want Persian display names. ASCII slugs remain mandatory for copy-paste URLs (existing `asciiSlug` contract).
- **A3:** SKU prefix stays category-owned. Multi-category products need exactly one **primary** category for SKU allocation.
- **A4 (closed 2026-09-12):** Live RETAIL home `categoryBanners.categoryIds` is empty. New categories were dropped by reverse-then-slice plus a hard `maxItems` 10. See `docs/architecture/category-identity-and-home-merch.md`.
- **A5:** High-risk independent Reviewer + Security required before the membership migration ships (schema + catalog query). Hero/locale presentation is low/medium and can ship first.

### Constraints

- Modular monolith: Next.js 15 `apps/web` + NestJS `apps/api` + PostgreSQL. No new service.
- Preserve public `/category/{slug}` URLs; 301 via existing `seo_redirects` when a slug changes.
- Home LCP: a single above-fold image with `priority`. Inner pages must not inherit home slide 0 as LCP.
- Do not edit files claimed by TASK-20260912-001 (`WholesaleBlocksRenderer`, `WholesaleStats`, `AdminBlockEditor`) until released. Hero isolation uses page scope context so those files stay untouched.
- Stale August claims still list `category.service.ts`, `AdminCategories.tsx`, `product.entity.ts`. Membership work must reclaim them in handoff before editing.

## 2. Current-state audit

| Item | Current state | Evidence | Decision |
| --- | --- | --- | --- |
| Category identity | One `categories.name` (unique). `nameEn` column exists, unused in admin create/save | `category.entity.ts`, `AdminCategories.tsx` | Split display vs URL: `name` = fa label, `nameEn` = en label + slug source |
| Slug create | `uniqueSlug(body.slug \|\| seed \|\| name)` then `normalizePublicSlug` **rejects spaces before transliteration** | `public-slug.ts` lines 40–42; `category.service.ts` `create` | Slugify first; spaces in Persian names are valid |
| Home category grid | Fetches all ACTIVE; optional CMS `categoryIds` exclusive filter; `displayName` prefers Persian tokens; `fallbackFor` uses **first English token** as image key | `RetailCategoryBannerGrid.tsx` | `auto` = all ACTIVE; `manual` = pinned order; label from locale fields not name-splitting |
| Home shortcuts | Four hardcoded links | `RetailHomeCategoryLinks.tsx` | Derive from catalog or CMS; no code-owned category list |
| Product↔category | `products.categoryId` many-to-one; list filter `p.categoryId = :id`; SKU from that row | `product.entity.ts`, `product.service.ts` | Add membership table; keep `categoryId` as denormalized primary during dual-write |
| CMS stats digits | Defaults call `toPersianDigits()` at seed time; admin stores whatever the operator typed; render prints the string | `defaults.ts`, `AdminBlockEditor` stats fields, `WholesaleStats` | Store Latin digits; shape at render with `UiLocale` |
| Wholesale inner heroes | Any CMS `hero` goes through `HeroSection` which **always** `applyWholesalePromoHeroSlides()` | `HeroSection.tsx` line 170 | Inject campaigns only when `pageKey === 'home'` |
| Retail inner heroes | `RetailHero` always `applyRetailCampaignHeroSlides()`; empty image falls back to `/retail/hero-model.webp` | `RetailHero.tsx` | Same pageKey gate; no home fallback image off-home |
| Boutique | `normalizeHeroSlides(..., DIGIPAY_RETAIL_HERO_SLIDE)` even off-home | `BoutiqueHero.tsx` | Home-only fallback |
| Wholesale about | Code-owned `WholesaleAboutView` (not `CmsPage`) | `about/page.tsx` | Keep experience; optional later `pageHero` from CMS `about` |
| Blog / workshop | Shared `.page-hero` CSS gradient, not CMS | `globals.css`, `blog/page.tsx` | Add CMS `pageKey=blog` + `PageBanner`; stop sharing a fake “home” plate |
| Locale | No `en` runtime; `toPersianDigits` used at call sites | `@taranom/persian-utils` | One presentation helper; locale from channel document later, default `fa` |

### Root causes (not symptoms)

1. **Identity leak:** Display name, URL, merchandising key, and SEO seed key were one field. Persian names with spaces fail slug validation; English-first names accidentally satisfy slug + image fallback + seed matching.
2. **Presentation leak:** Numerals were formatted when **writing defaults**, not when **rendering**. Admin Latin digits and seed Persian digits therefore look like two fonts.
3. **Page-scope leak:** Home campaign injection lived inside the hero **component**, not the home **page**. Every inner `hero` block became the homepage banner. Hardcoded home H1 (`sr-only`) also leaked.

## 3. System context

```text
Admin (JWT ADMIN)
  → /admin/categories  (labels, slug, banner, membership UI on product form)
  → /admin/site-content (pageKey-scoped blocks: hero, stats, categoryBanners)
  → Nest /v1/categories /v1/products /v1/cms/admin/site-content
  → PostgreSQL categories, product_category_membership, products.categoryId, site_contents

Public (.com WHOLESALE | .ir RETAIL)
  → CmsPage(channel, pageKey) → CmsPageScope → channel renderer
  → Hero only injects campaign if pageKey=home
  → Category grid reads ACTIVE categories (or manual pins)
  → Product listing: membership OR primary categoryId, plus channel flags
```

Actors: store admin, retail shopper, wholesale buyer. Trust boundary: public GETs are unauthenticated; writes are ADMIN JWT. No new secrets.

### Primary journeys

1. Create category in Persian → slug generated → appears on both homes (unless HIDDEN or manual pin excludes it).
2. Assign product to شومیز (primary) and کت (additional) → both landings list it; SKU prefix from شومیز.
3. Edit about/contact/wholesale/blog banner in CMS for that pageKey → only that route changes.
4. Type `+120` in stats → fa site shows `+۱۲۰`; switching locale to `en` shows `+120` without re-saving.

## 4. Information architecture

| Route | Intent | Banner source | Indexing |
| --- | --- | --- | --- |
| `/` (channel home) | Acquire; campaign carousel | CMS `home` `hero` + **home-only** campaign inject | Index |
| `/about` | Brand story | CMS `about` `hero`/`pageHero` only. Wholesale code page: no home inject | Index |
| `/wholesale` | B2B terms | CMS `wholesale` hero only | Index |
| `/contact` | Reach the mill | CMS `contact` hero or none | Index |
| `/blog` | Articles | CMS `blog` `pageHero` (new pageKey) | Index |
| `/category/{slug}` | Category landing | Category `heroImage` / `bannerUrl`, never home campaign | Index if `isIndexable` |
| `/products` | Catalog | No home campaign hero | Index |

Campaign plates (`wholesale-promo-2026/*`, DigiPay, Prima/Negin) are **home merchandising**, not a global visual system.

## 5. Capability / module map

| Module | Owns | Must not own |
| --- | --- | --- |
| Category aggregate | id, nameFa (`name`), nameEn, slug, skuPrefix, status, banners, SEO | Product stock/price |
| Product aggregate | SKU, channel flags, **primaryCategoryId**, memberships | Campaign banners |
| CMS `site_contents` | Blocks per `(channel, pageKey)` | Catalog membership |
| Presentation locale | Digit/date shaping at render | Persisting Persian digits as source of truth |
| Hero policy | `pageKey === 'home'` ⇒ campaign inject | Inner page media |
| Channel flags | `showOnRetail` / `showOnWholesale` | Category duplication |

## 6. Data model

### Category (existing table, additive)

Keep table `categories`. Semantics:

| Field | Role | Validation |
| --- | --- | --- |
| `name` | Persian display label (required) | Non-empty; unique among non-deleted |
| `nameEn` | English display + preferred slug source | Recommended; `[A-Za-z0-9][A-Za-z0-9 \-]*` after trim |
| `slug` | Public ASCII id | Unique; `asciiSlug(nameEn \|\| name)`; reserved-path check **after** slugify |
| `skuPrefix` | SKU allocator for **primary** memberships | Unchanged |
| `status` | `ACTIVE` \| `HIDDEN` | Home/public listings skip HIDDEN |
| `bannerUrl` | Square merchandising tile | Optional |
| `heroImage` | Category landing banner | Optional; never copied from home CMS |

No requirement that `name` contain Latin letters.

### Product membership (new)

```text
product_category_membership
  productId   uuid not null  → products.id ON DELETE CASCADE
  categoryId  uuid not null  → categories.id ON DELETE RESTRICT
  isPrimary   boolean not null default false
  sortOrder   int not null default 0
  createdAt   timestamptz
  PRIMARY KEY (productId, categoryId)
  UNIQUE (productId) WHERE isPrimary = true
```

`products.categoryId` remains the primary category (expand/migrate/contract). Writers dual-write membership + `categoryId`. Readers: listing uses

```sql
p.categoryId = :id
OR EXISTS (
  SELECT 1 FROM product_category_membership m
  WHERE m."productId" = p.id AND m."categoryId" = :id
)
```

until `categoryId` is contracted in a later task (out of this program unless dual-write is proven stable).

Lifecycle: deleting a category is blocked while memberships exist, or products are moved/re-primary first. Soft-delete category already exists (`deletedAt`).

### CMS stats / numeric copy

Store **canonical Latin digits** (and optional leading `+`). Example: `"+120"`, `"1401"`. Do not store `۱۲`. Render with `shapeDigitsInText(value, locale)`.

Phone `href` stays `tel:0915…` (Latin). Visible labels may be shaped.

## 7. API contracts

No new microservice. Additive fields only.

### Categories

- `POST/PATCH /v1/categories` accepts `name`, `nameEn`, `slug?`.
- Server generates slug: `asciiSlug(explicitSlug || nameEn || name)`.
- Public `GET /v1/categories` includes `name`, `nameEn`, `slug`, `bannerUrl`, `sortOrder`.
- `GET /v1/categories/slug/:slug` keeps ASCII lookup (`asciiSlug(param)`).

### Products

- Create/update: `categoryId` (primary, required for SKU) + `categoryIds?: string[]` (additional; primary included or inferred).
- Public product JSON: `categoryId`, `categories: { id, slug, name, nameEn }[]`.
- `GET /v1/products?categoryId=` and `?categorySlug=` match membership ∪ primary.

Idempotency: membership upsert by `(productId, categoryId)`. Exactly one `isPrimary`.

### CMS

- Unchanged URL: `GET /v1/cms/site-content/:channel/:pageKey`.
- Renderer receives `pageKey` via `CmsPageScope`. Campaign inject is **not** a stored flag operators can forget; it is code policy keyed by `pageKey`.

Errors: 400 on empty name, reserved slug, missing primary category on create, two primaries. 409 on slug/name unique violation.

## 8. Presentation and UI

### Locale

```ts
type UiLocale = 'fa' | 'en';
shapeDigitsInText(text, locale) // fa → Persian numerals; en → Latin
```

Default `fa`. Future: `document.documentElement.lang` or a settings `uiLocale`. Admin preview of stats must call the same helper so operators see what the site will show.

Do not call `toPersianDigits` inside `defaults.ts` for numbers that editors will overwrite. Defaults may keep Latin `"1401"`; render shapes them.

### Category admin

Two labeled fields: «نام فارسی» (`name`), «نام انگلیسی (برای آدرس)» (`nameEn`). Slug preview from server, editable. Banner 1:1 optional. Creating with only Persian name succeeds.

Product form: multi-select categories + radio/star for primary. SKU prefix hint from primary.

### Home category block

Mirror featured-products source modes (`docs/adr/2026-09-08-featured-products-block.md`):

- `source=auto` (default): all ACTIVE, `sortOrder`, cap `maxItems` (home budget 12–16 tiles max; current 10 is fine).
- `source=manual`: `categoryIds` order; **do not silently hide** others unless the admin UI says «فقط همین‌ها». Preferred: manual is pin+order, auto-append remaining ACTIVE below, or exclusive with an explicit checkbox `exclusive`.

`RetailHomeCategoryLinks` must read the same query or CMS, not a hardcoded quartet.

### Heroes

| pageKey | Component policy |
| --- | --- |
| `home` | Current carousel + campaign prepend; one LCP image; sr-only brand H1 allowed |
| any other | CMS slides only; no campaign prepend; no `/retail/hero-model.webp` / promo fallback; visible H1 = page headline; autoplay off unless CMS sets it and copy is that page’s |
| routes without CmsPage (`/blog`, wholesale `/about`) | `PageBanner` from that pageKey or a local default **file**, never `apply*Campaign*` |

`HeroSection` / `RetailHero` / `BoutiqueHero` read `useCmsPageScope().pageKey`. Missing scope ⇒ treat as **not home** (fail closed: no campaign leak). Home always wraps via `CmsPage`.

Inner page with empty `imageUrl`: gradient/copy only (existing `.page-hero` language), not the partnership plate.

Accessibility: icon-only carousel controls already need `aria-label`; pause for autoplay > 5s; `prefers-reduced-motion` disables ticker/loop. Links remain `<Link>`/`<a>`.

## 9. Security

- Category/product writes: existing ADMIN JWT + RolesGuard.
- Public category list: no PII.
- Membership must not let a hidden category leak products on the other channel: listing still applies `showOnRetail` / `showOnWholesale`.
- CMS HTML remains sanitized (`cms-sanitize.ts`). Banner URLs: existing upload allowlist; no path traversal.
- Slug changes write `seo_redirects` (already). Do not 302 unrelated URLs to `/`.
- Migration is expand-only first; no drop of `categoryId` in the same release.

## 10. Deployment, tests, rollout

### Phases

**Phase 0 — Architecture (this doc + ADR).** Acceptance: defects and target invariants are written; no production change.

**Phase 1 — Page-scoped heroes (no migration).**  
`CmsPageScope`, `page-hero-policy`, gate `HeroSection` / `RetailHero` / `BoutiqueHero`. Spec for inject-only-home.  
Acceptance: `/contact` and `/wholesale` HTML do not contain `partnership-d8771aca17fe` or DigiPay plate paths; `/` still does. Home TTFB/LCP not worsened (same LCP image).  
Does not edit TASK-20260912-001 files.

**Phase 2 — Locale shaping.**  
`shapeDigitsInText` in `@taranom/persian-utils`. Apply on storefront stats/trust/about facts and admin preview. Stop seeding Persian digits in new default JSON. Optional backfill: Latinize existing `stats.items[].value`.  
Blocked on `WholesaleStats` / `AdminBlockEditor` until 001 releases.  
Acceptance: saving `12` in CMS shows `۱۲` on fa home.

**Phase 3 — Category identity (reclaim stale category files).**  
Fix `normalizePublicSlug` (slugify then validate). Admin `name` + `nameEn`. Home label from `name`/`nameEn`. `categoryBanners` source auto/manual. Replace hardcoded home links.  
Acceptance: Persian-only name with spaces creates and appears on home when `source=auto`.

**Phase 4 — Membership migration (Reviewer + Security).**  
Table + dual-write + list query + admin multi-select. Excel export includes extra category slugs.  
Acceptance: product in two categories listed on both; SKU unchanged; channel flags still hide off-channel products.

**Phase 5 — Inner PageBanner + blog pageKey.**  
CMS `blog` / wire wholesale about optional banner. Remove shared “looks like home” CSS-only hero where a real image is required.

### Rollback

Phase 1: revert the three hero files + scope; campaigns return globally (previous bug).  
Phase 4: keep `categoryId` populated; listing can ignore membership table if a flag `MEMBERSHIP_READ=off` is needed. Do not drop columns in the same release.

### Tests

- Unit: `page-hero-policy.spec.ts` (home injects, about does not; empty image no home fallback off-home).
- Unit: `normalizePublicSlug('کت زنانه')` → `kt-znanh` or `nameEn` `women-coats`.
- Unit: `shapeDigitsInText('12', 'fa') === '۱۲'`.
- API: create category Persian name; product two memberships; GET products by each categoryId.
- Browser: `.com/contact` banner ≠ home partnership; `.ir/about` ≠ DigiPay plate; home still shows campaign.

### Performance

- No extra home product fetch. Category list already cached (`s-maxage=60`).
- Membership query uses PK/index; avoid N+1 (join or `WHERE EXISTS`).
- Inner pages: dropping campaign images **reduces** bytes vs today.
- Continue: max 12–16 home cards; one LCP `priority` on home only.

## 11. Critical sequences

### Create category (fa name)

```text
Admin POST { name: "کت زنانه", nameEn: "women coats" }
  → validate name
  → slug = unique(asciiSlug(nameEn)) = "women-coats"
  → insert ACTIVE
  → outbox/catalog revalidate (existing CMS/catalog tags)
Home GET /categories → includes row
Grid label fa = "کت زنانه"; href = /category/women-coats
```

### Assign two categories

```text
PATCH product { categoryId: A, categoryIds: [A, B] }
  → allocate SKU only if new and primary A
  → upsert membership (A primary, B additional)
  → dual-write products.categoryId = A
Listing /category/B → EXISTS membership B
```

### Render hero

```text
CmsPage(pageKey)
  → CmsPageScope.pageKey
  → HeroSection
  → if pageKey==home: apply*Campaign(slides)
    else: slides as stored
  → if !home && !imageUrl: no media, copy only
```

## 12. Open decisions (owner)

| ID | Question | Default if unanswered |
| --- | --- | --- |
| D1 | Is `nameEn` required for new categories or only recommended? | Recommended; transliteration fallback |
| D2 | Manual `categoryIds`: exclusive list or pin+append? | Pin+append unless exclusive checkbox |
| D3 | When to drop `products.categoryId`? | Not in this program; dual-write only |
| D4 | Enable `en` UI in admin/settings now? | No; helper ready, default `fa` |
| D5 | Wholesale `/about` stay code-owned? | Yes; still no home hero inject |

## 13. Review checklist

- Primary journeys covered; non-goals explicit.
- Current routes and files inspected; URLs preserved.
- Editors can change requested content without English-in-name hacks.
- Code-owned: slug policy, campaign inject, digit shaping. CMS-owned: copy, images, which categories are pinned.
- Complexity: one join table, no new service, no page builder.
- Security: admin-only writes; channel flags on read; expand-only migration.
- Performance: home card budget and single LCP preserved.
- Unclaimed files for Phase 1; later phases require reclaim notes in handoff.
