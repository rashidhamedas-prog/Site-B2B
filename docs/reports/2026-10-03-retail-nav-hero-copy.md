# Retail nav motion + hero copySide (2026-10-03)

## Goal

1. Premium desktop nav states (hover / active / focus / mega open) on retail header.
2. Stop overlay hero copy from sitting on the product; default to RTL logical start (visual right).

## Design sources

- **21st.dev** component `18169` (Underlined Navigation Menu): `before` underline + `scale-x` on hover/active — adapted to `--retail-gold`, no shadcn NavigationMenu dependency, no GSAP.
- **RTL logical origin**: `transform-origin: inline-start` so the wipe grows from the reading start in Persian.
- **Stitch prompt**: `docs/prompts/stitch-retail-nav-hero-fa.md` (brand composition reference; not pasted HTML).

## Root cause (hero)

`RetailHero` used `justify-end` on the overlay flex row. In RTL, that packs copy to the **visual left**, over product plates that are framed left (empty color field on the right).

## Changes

| File | Change |
| --- | --- |
| `RetailHeader.tsx` | Gold underline wipe, lift on hover, focus ring, chevron rotate, mega fade |
| `RetailHero.tsx` | `justify-start` default; per-slide `copySide`; flip scrim/object-position when `end` |
| `hero-slides.ts` | `HeroCopySide` + parse + `resolveHeroCopySide` |
| `hero-slides.spec.ts` | copySide parse / default / invalid |
| `AdminBlockEditor.tsx` | CMS select «جای متن روی بنر» |

## Perf

- CSS transforms/opacity only; `prefers-reduced-motion` disables transitions.
- No new client libraries; mega panel stays CSS-driven.
- Hero LCP path unchanged (slide 0 priority).

## Admin

Per slide: **راست تصویر (start)** vs **چپ تصویر (end)**. Default start for product-on-left plates.
