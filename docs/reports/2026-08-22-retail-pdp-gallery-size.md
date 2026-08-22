# Retail PDP gallery + size selection (2026-08-22)

## Context

TASK-003 shipped editorial 3:4 cards and sent home shoppers to the PDP via «انتخاب سایز». The product page still used a 4:5 gallery, sub-44px hits, hover-ish thumbs, add-to-cart without a required size, and a lightbox with no keyboard or prev/next.

## Change

`RetailProductDetail` only (page route stays with TASK-018).

- Gallery aspect `3:4`; thumbnail rail first in DOM (`flex-col` → `lg:flex-row` so RTL thumbs sit beside the image).
- Thumbs 64px, click-only, focus ring.
- Color/size chips `min-h-11`; unavailable sizes disabled; labels show the selected value.
- Add-to-cart disabled until a size is chosen when sizes exist (`سایز را انتخاب کنید`).
- Mobile sticky bar shows price + size readout.
- Lightbox: Escape, ArrowLeft/Right, on-screen chevrons.
- Hover zoom respects `motion-reduce`.
- Related grid already uses compact `RetailProductCard`.

No new npm dependencies. No change to `[slug]/page.tsx`, header, or middleware.

## Validation

- `cd apps/web && npx tsc --noEmit` → exit 0

## Rollback

Revert `apps/web/src/components/retail/RetailProductDetail.tsx` and `design-system/default/pages/product.md`.
