# Brand Guidelines — پوشاک ترنم

**Updated:** 2026-07-30  
**Channels:** Wholesale (`poshaktaranom.com`) · Retail (`poshaktaranom.ir`)

## Identity

| | |
|--|--|
| Brand (FA) | پوشاک ترنم |
| Brand (EN) | POSHAK TARANOM |
| Category | Women's fashion manufacturing — linen, cotton, outerwear, sets |
| Voice | Trustworthy, warm, production-first (B2B) · elegant, calm (B2C) |
| Direction | RTL |

## Colors (locked)

| Role | Hex | Notes |
|------|-----|--------|
| Primary | `#1B5C4A` | Forest green |
| Primary light | `#2D7A5F` | |
| Primary dark | `#124035` / `#0F2F28` | Hero backgrounds |
| Gold / Secondary | `#C9A84C` | Accents, CTAs, eyebrow |
| Gold light | `#E5C97C` | |
| Gold dark | `#A88530` | |
| Cream (B2C) | `#F6F1E8` | Page bg only — not hero fill |
| Ink | `#1A1A1A` | |

**Do not use:** purple gradients, neon glow, generic AI cream+terracotta look, floating promo badges on hero media.

## Typography

- Primary UI: **Vazirmatn** (400–800)
- Max 2 type roles on banners: display + body
- Headline ≥ 32px equivalent; body ≥ 16px; contrast ≥ 4.5:1

## Logo

| File | Use |
|------|-----|
| `assets/brand/logo-512.png` | Hero / print |
| `assets/brand/logo-128.png` | Favicon / chrome |
| `apps/web/public/logo-512.png` | Live site |

Clear space ≈ ¼ logo height. Prefer gold or white on dark green heroes. Do not stretch or recolor off-palette.

## Hero banner rules

1. Full-bleed visual plane (edge-to-edge)
2. Brand signal first; one H1; one short body; one CTA group
3. No cards, stickers, or floating badges on the photo
4. Safe zone: critical text in central 70–80%
5. Prefer lifestyle / model plates — not raw white-background catalog SKUs
6. Overlay copy in HTML/CSS (or Figma) — never burn Persian text into AI images when avoidable
7. Export: desktop `1920×1080` (or `1920×800`), mobile crop `1080×1350` optional; WebP/JPG ≤ 400KB target after compress

## Category tile banners (retail 3×3)

1. Aspect **1:1** (square); served from `/banners/category-2026/` or admin upload
2. Name overlay in HTML/CSS on the tile — do not bake Persian text into the image
3. Tap/click → `/products?categoryId={id}`
4. Editable per category in `/admin/categories` (`bannerUrl`); grid block in `/admin/site-content` (`categoryBanners`)
5. Brand colors on scrim: forest green + gold accent; no purple/glow/promo stickers

See `assets/banners/category-2026/README.md`.

## Messaging (hero)

### Retail (تکی)
- Eyebrow examples: زیبایی در هارمونی با شما · کالکشن فصل · ست‌های آماده
- CTA: مشاهده جدیدترین‌ها / مشاهده مجموعه

### Wholesale (عمده)
- Eyebrow: پوشاک ترنم
- Themes: مستقیم از تولیدی · پرفروش بوتیک · ست سودآور
- CTA: مشاهده محصولات / ثبت‌نام عمده‌فروش

## Assets pipeline

```
assets/banners/hero-intake/     ← user drops source photos here
assets/banners/hero-2026/       ← generated / exported finals
assets/brand/                   ← logo + tokens references
```

See `assets/banners/hero-intake/README.md` for photo brief.
