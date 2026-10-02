# Retail hero + CTA editorial redesign

**Date:** 2026-10-02  
**Task:** TASK-20261002-007  
**Channel:** Retail (`.ir`) only  
**Depth:** skill-top full

## Direction chosen

**Full-bleed fashion editorial** (brand guidelines §Hero + user performance rules), not hard split panel.

Rationale:
- `docs/brand-guidelines.md` already locks full-bleed + soft RTL copy zone + gold CTA
- Screenshot pain: solid green wall vs product photo felt boxed; CTA under-scaled
- DigiPay/Prima `artwork` plates stay 24:7-compatible; no wholesale change

## Changes

| File | What |
|------|------|
| `RetailHero.tsx` | Soft cinematic scrim, RTL-right copy, larger gold CTA, exit fade into trust strip, `retail-editorial-hero`, reduced-motion on crossfade |
| `globals.css` | Taller mobile frame for CTA room; desktop still 24:7 |
| `RetailTrustStrip.tsx` | Drop top border clash with hero; softer gold icon ring |
| `HeroCarousel.tsx` | Dot focus-visible by tone; no `transition-all`; slightly larger active pill |

CTA label remains CMS (`مشاهده محصولات` when saved that way).

## Skills / sources used

- ui-ux-product-design, ui-ux-pro-max (fashion ecommerce DS — rose palette **rejected** in favor of locked forest/gold), banner-design rules, web-design-guidelines, h2h (no fake urgency), brand guidelines, ECC plan-before-execute
- Slack search: no relevant hero decisions found
- Reference pattern: existing wholesale `wholesale-editorial-hero`

## Verification

- `npx tsc --noEmit` in `apps/web` — (recorded in handoff)
- Manual sync checklist: carousel, DigiPay/light artwork, LCP slide 0 priority, trust strip adjacency

## Non-goals / residual

- No new hero artwork assets
- No CMS content migration
- Commit/push/deploy only after owner approval (user git rules)
