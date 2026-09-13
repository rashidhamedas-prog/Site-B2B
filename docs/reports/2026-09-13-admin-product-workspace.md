# Admin product workspace — 2026-09-13

## Executive outcome

`/admin/products` is one workspace: channel filter in the URL, complete editor sections, and a stored alt for every product image. List, editor, API, PDP, cards, OG, and Product JSON-LD now read the same `images[]` + `imageAlts` map.

## Scope

- Markets: retail `.ir` and wholesale `.com`, one product row.
- Mode: implement (architecture already chosen; Saleor/Medusa/Shopify researched, not installed).
- Slack: no matching product-workspace messages.

## Sync contract

| Surface | Rule |
| --- | --- |
| List `?channel=` | Filters rows; stock/price follow that channel |
| Excel عمده/تکی/کامل | Export only |
| Editor | Dual-pane retail + wholesale; filter does not wipe the other channel |
| Save | `images`, `imageAlts`, `nameEn`, `description`, FAQ, care |
| PDP / OG / JSON-LD | Same stored alt; fallback `{name} از روبرو` |
| FAQ schema | Not emitted (rich results retired May 2026) |

## Evidence

- Saleor `ProductMedia.alt`, Medusa ProductImage metadata, Shopify MediaImage.alt, PHASE-04 alt plan.
- Migration `20260913-010-product-image-alts` is additive `jsonb NOT NULL DEFAULT '{}'`.

## Residual

- Bulk CSV alt import not in this pass.
- `ProductInternalLinkPicker` still TASK-20260910-001.
- Live admin click and production migration run after deploy.
