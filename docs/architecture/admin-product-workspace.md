# Admin product workspace

Confirmed 2026-09-13. Completes `/admin/products` without a second PIM.

## Facts

- One `products` row serves retail (`.ir`) and wholesale (`.com`). Channel flags, prices, stock, SEO, full content, and internal links are already split.
- Gallery is still `images: string[]`. Storefront/OG/JSON-LD used the product name (or empty alt). Omnichannel media registry has `altText` but the product form never wrote it into the catalog JSON.
- List API already accepts `channel=RETAIL|WHOLESALE`. The table ignored it; Excel buttons «عمده / تکی / کامل» are export-only.
- `faqItems`, `careInstructions`, `description`, and `nameEn` exist on the entity/DTO but were missing or hidden in the editor.

## Research used (not installed)

| Source | Takeaway applied here |
| --- | --- |
| [Saleor ProductMedia.alt](https://docs.saleor.io/api-reference/products/objects/product-media) + dashboard #6608 | Alt is a first-class field on each media URL, edited next to the tile, not a page-builder |
| [Medusa ProductImage](https://docs.medusajs.com/resources/references/product/models/ProductImage) + `@alpha-solutions/medusa-image-alt` | URL stays the identity; alt lives in metadata returned on the product payload |
| Shopify MediaImage.alt | One alt per image; fallback is product title; storefront and OG stay in sync |
| Ghost/Payload locale switcher (blog workspace) | One `?channel=` query is the list filter source of truth |
| Google image + Product schema | Visible `alt` and `ImageObject.name/caption` must match; no fake FAQ rich-result promise (FAQ rich results retired May 2026) |
| PHASE-04 image alt plan | `{name} از روبرو` / `{name} — نمای …` / `رنگ {color}` |

## Decisions

1. Workspace query: `?channel=ALL|RETAIL|WHOLESALE&q=&section=`. Defaults: کامل + هویت.
2. `imageAlts: Record<url, alt>` jsonb on the product. `images[]` order is unchanged so existing readers do not break.
3. Save sanitizes HTML, rejects `javascript:` keys, keeps only URLs still in the gallery (max 40, 160 chars). Empty alts are filled from the name/color/fabric suggestion so PDP/OG/JSON-LD never emit a blank LCP alt.
4. Retail and wholesale SEO/content stay dual-pane on one save. Channel filter only changes the **list**, not the other channel’s fields.
5. No Saleor/Medusa install, no new media table, no public URL change.

## Non-goals

- Bulk CSV alt import (Medusa plugin pattern) — later if needed
- Rewriting `images` into `{url,alt}[]` objects
- Live GSC / Merchant Center writes
- Claiming `ProductInternalLinkPicker` (still TASK-20260910-001)

## Ownership

| Surface | Channel scoped | Owner |
| --- | --- | --- |
| List filter, editor sections, gallery alts, FAQ/care/nameEn/description | list filter yes; fields dual | this workspace |
| Public PDP/cards/OG/JSON-LD alt | yes | this workspace + existing product JSON |
| Internal links / color stock grid | already split | existing pickers |
| Omnichannel media registry alt | complementary, not SoT | 026 registry; product `imageAlts` wins on storefront |

## Assumptions

- One product row already owns both channels; a second PIM is not required.
- Excel «عمده / تکی / کامل» remain export actions, not list filters.
- Slack had no product-workspace decisions (search 2026-09-13).
- FAQ on PDP is human content only; FAQ rich results retired May 2026.

## System context

Actors: catalog editor (admin JWT), retail shopper (`.ir`), wholesale buyer (`.com`), Googlebot/OG scrapers.

Trust boundary: `/admin/products` and `POST/PATCH /v1/products` stay admin-guarded. Public catalog already returns the product JSON; `imageAlts` is not a secret. Alt keys are treated as untrusted URLs and stripped of `javascript:` / `data:` / HTML.

## API / save contract

- `GET /products/admin?channel=&search=` filters the **list**.
- Create/update accept `imageAlts`, `nameEn`, `description`, `faqItems`, `careInstructions` plus existing dual-channel SEO/content.
- Server `fillMissingProductImageAlts` is the last writer so empty gallery slots never ship a blank LCP alt.
- Rollback: drop `imageAlts` column; readers fall back to `{name} از روبرو`.

## Critical sequence

```text
Editor uploads / edits alt
  → sanitize (160 chars, no HTML, prune orphan keys)
  → fill missing from name/color/fabric
  → persist products.images + products.imageAlts
  → public findBySlug spreads both
  → PDP / card / OG / ImageObject.name+caption read the same map
```

## Security

- Admin auth unchanged; no new public write.
- Alt map keys rejected if `javascript:` / `data:` / `vbscript:` or >500 chars.
- Values strip tags and C0 controls. Max 40 pairs.
- PDP FAQ/care render as text, not HTML. Existing retail body still goes through `lightSanitizeHtml`.

## Tests, rollout, rollback

- Specs: `product-image-alt`, `admin-product-workspace`, API alt helper, migration SQL.
- Rollout: additive jsonb column default `{}`; existing gallery keeps working with suggested alts on next save.
- Residual: no bulk CSV; omnichannel registry alt is complementary.
