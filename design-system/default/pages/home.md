# Home Page Override — پوشاک ترنم

> Overrides `MASTER.md` for the public homepage only.

## Section Order

1. Hero (full-bleed) — brand + one headline + one sentence + CTA group
2. Trust strip — ارسال / تعویض سایز / پرداخت امن / دوخت کارگاهی (not inside hero)
3. Category tiles — editorial 2× / 5×, «مشاهده مجموعه» always visible on mobile
4. Featured products — compact editorial grid, max 12
5. FAQ accordion
6. CTA banner — wholesale handoff / campaign (CMS)

## Hero Rules

- Full-bleed visual plane (gradient fabric atmosphere)
- Brand name as hero-level signal
- No floating badges, promo chips, or stats cards on hero
- Max content: brand line, headline, one supporting sentence, two CTAs
- **Wholesale editorial (2026-09-26):** class `wholesale-editorial-hero` on `.storefront-hero-frame` — mobile ~5/4 max 22.5rem; desktop 24/7 taller cap; single two-stop emerald scrim (no gold radial / grid); 2px gold hairline above eyebrow; solid gold primary CTA + white outline secondary; H1 remains sr-only; only slide 0 is LCP
- Retail keeps shared `.storefront-hero-frame` 2:1 / 24:7 unchanged

## Product Cards

- Prefer borderless editorial look; light shadow only on hover
- Aspect 3:4 imagery, second photo on desktop hover (`md+`, `prefers-reduced-motion` off)
- Wholesale Spec Sheet: one availability chip on image; fabric/size/colors as body ledger; MOQ emerald pill; full-width order CTA; price gate «پس از ورود»
- Featured home grid wholesale: `lg:grid-cols-4` (not 6) so plates stay readable
- Home tiles do not carry trust icons; max 12 products
