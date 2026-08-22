# Product Page Override — پوشاک ترنم

> Overrides `MASTER.md` for the retail PDP only (`RetailProductDetail`).

## Layout

1. Gallery — 3:4 main image, thumbnail rail first in DOM (right of image on large RTL)
2. Title, SKU, fabric, price
3. Color (≥44px chips) then size (≥44px chips) + size-guide
4. Quantity + add to cart (desktop); sticky bar on mobile
5. Shipping/returns facts
6. Details accordion
7. Related products — compact editorial cards (max 12)

## Gallery

- Aspect `3:4` to match storefront cards
- Thumbs are tappable, never hover-only; min hit ~64px
- One `priority` image (LCP); thumbs are not priority
- Lightbox: Escape, previous/next, reduced-motion on hover zoom

## Size and cart

- Unavailable sizes are disabled, not hidden
- Add-to-cart is disabled until a size is chosen when sizes exist
- Sticky mobile bar shows price + selected size (or «سایز را انتخاب کنید»)
- Copy: selected color/size in the label; low stock as «فقط N عدد»
