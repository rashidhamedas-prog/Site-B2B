# Design System Master — پوشاک ترنم B2C (هم‌تراز موکاپ)

**Reference mockup:** `apps/web/public/retail/mockup-reference.png`  
**Live storefront:** `/retail`  
**Updated:** 2026-07-23

## Locked look (match mockup)

| Token | Value |
|-------|-------|
| Forest green | `#1B5C4A` / dark `#0F2F28` |
| Gold | `#C9A84C` |
| Cream bg | `#F6F1E8` |
| Card beige | `#F3EEE6` |
| Ink | `#1A1A1A` |

## First viewport (hero)

- White header + gold geometric mark + `POSHAK TARANOM`
- Home-only news ticker (TV crawl, CSS loop, pause control)
- Slim cinematic hero — mobile `2:1` / desktop `24:7` (1920×560), shared `.storefront-hero-frame`
- Model photo left, copy right (RTL); body clamped to two lines
- Eyebrow gold: «زیبایی در هارمونی با شما»
- Visible H1 remains sr-only SEO; slide title is H2
- One primary CTA names the next action; secondary is quieter
- No floating badges/cards on hero media

## Product strip

- Cream section, max 12 editorial tiles (2× / 4× grid)
- Borderless card, 3:4 image, second photo on desktop hover
- Heart wishlist (44px hit), discount/new/sold-out badges
- Color dots + centered name + fabric + price (Toman)
- Home/category: compact — CTA is «انتخاب سایز» (PDP); no per-card trust icons
- Catalog: size chips + add-to-cart
- Trust strip lives once under the hero, not on every card
