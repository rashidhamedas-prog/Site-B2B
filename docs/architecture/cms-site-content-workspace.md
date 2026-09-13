# CMS site-content workspace

Date: 2026-09-13  
Task: TASK-20260913-014

## Confirmed

- One modular monolith. `site_contents` is one row per `(channel, pageKey)`.
- Blocks stay typed (`hero`, `chrome`, `products`, …). This is not a page builder and not a second CMS.
- Public reads require `RETAIL|WHOLESALE`. Writes must name the channel.
- HTML is sanitized on write. Product gallery alts live on `products.imageAlts` (TASK-20260913-010).
- Settings SEO (`/admin/settings?section=seo`) is the sitewide default. CMS `seo` is the per-page override.

## Research applied (patterns, not installs)

| Source | What we copied |
| --- | --- |
| Payload CMS blocks + SEO plugin | Typed blocks; page `meta` group: title, description, image, alt |
| Payload upload alt (v3.71) | Instance alt, then caption, then empty — never filename |
| Ghost Admin | Workspace URL is source of truth |
| Saleor `ProductMedia.alt` / Medusa image-alt | Per-image alt as a first-class field |
| Taranom blog/settings workspaces | `?channel=` + sibling page key; save then refetch |

## Ownership

| Kind | Owner |
| --- | --- |
| Code | Block schemas, sanitizer, pageKey allowlist, robots for search/utility |
| CMS | Blocks, page title, per-page SEO, chrome copy, legal/FAQ text |
| Settings | Sitewide title/OG/Organization, business phone/address |
| Product | Per-SKU `imageAlts` |
| Derived | Sitemap lastmod, ISR tags, fallback metadata |

Missing CMS body: hide the section or use `getDefaultBlocks`. Do not invent headlines.

## URL and SEO contract

Admin: `/admin/site-content?channel=RETAIL|WHOLESALE&page={pageKey}`

| pageKey | Retail route | Wholesale route | Index |
| --- | --- | --- | --- |
| chrome | layout chrome | layout chrome | n/a — sitewide SEO is settings |
| home | `/` | `/` | yes |
| about | `/about` | `/about` (designed view + optional CMS intro) | yes |
| contact | `/contact` | `/contact` | yes |
| shipping | `/shipping` | `/shipping` | yes |
| returns | `/returns` (RMA form) | `/returns` | yes |
| products | `/products` intro + catalog | `/products` intro + catalog | yes |
| collections | `/collections` | n/a (retail listing) | yes if collections exist |
| privacy | `/privacy` | `/privacy` | yes |
| terms | `/terms` | `/terms` | yes |
| wholesale | n/a | `/wholesale` | yes |

`site_contents.seo` allowlist: `title`, `description`, `ogImage`, `ogAlt`, `canonical`, `robots`.

Resolution: page SEO → settings channel default → hardcoded fallback. Canonical must be absolute and same-origin. `robots=noindex` is allowed for a published page that should stay out of Search.

## Sync rules

1. Save writes `title`, `blocks`, `seo`, `isPublished` on the named channel only.
2. After save, refetch the same `(channel, pageKey)` and revalidate that route (+ chrome busts layout).
3. Chrome phone/address may be copied from settings business. CMS does not write settings.
4. Product card images do not get a second alt map in CMS. The products block links to `/admin/products`.
5. CMS `image` / `gallery` / `hero` slides each have `imageAlt`.

## Non-goals

- New CMS, Payload/Ghost install, or unrestricted HTML page builder
- Changing public product/category URLs
- Inventing legal claims beyond existing business facts
- Two-way write between settings and chrome
