# ADR: Page-scoped heroes, locale-shaped digits, category membership

Date: 2026-09-12  
Status: Accepted  
Task: TASK-20260912-002

## Context

Three operator reports were the same architectural leak:

1. New categories did not appear (or required English-first names) because display name, slug, and merchandising image key were one string, and `normalizePublicSlug` rejected spaces before transliteration.
2. CMS stats showed Latin digits when typed and Persian digits when seeded, because `toPersianDigits` ran at default-write time instead of render time.
3. About / wholesale terms / contact / blog showed homepage campaign banners because `HeroSection` and `RetailHero` always prepended home campaign slides.

## Decision

1. **Page scope:** Campaign hero injection is a `pageKey === 'home'` policy in code, not a property of the hero widget. `CmsPage` provides `CmsPageScope`. Missing scope fails closed (no inject).
2. **Locale:** Store canonical Latin digits in CMS JSON. Shape for `fa` | `en` at render via `@taranom/persian-utils`. Do not persist Persian numerals as source of truth.
3. **Catalog:** `name` is the Persian label; `nameEn` is the English label and preferred slug source. Products gain `product_category_membership` with exactly one primary (SKU). `products.categoryId` dual-writes as primary until a later contract phase.
4. **Home categories:** `categoryBanners` follows the featured-products source model (`auto` vs `manual`). Hardcoded category link lists are not allowed.

## Consequences

- Inner CMS pages lose home plates immediately after Phase 1; operators must set that page’s own `imageUrl` if they want a photo banner.
- Membership is a schema change (Phase 4) with independent Reviewer + Security.
- TASK-20260912-001 still owns wholesale stats UI files; digit wiring there waits for release.

## Alternatives rejected

- Making `nameEn` the only name (breaks Persian admin).
- Persian slugs in URLs (breaks the ASCII copy-paste contract already in `asciiSlug`).
- A CMS checkbox “inject home campaign” on every hero (operators would leave it on; the bug returns).
- Microservices or a page builder.
