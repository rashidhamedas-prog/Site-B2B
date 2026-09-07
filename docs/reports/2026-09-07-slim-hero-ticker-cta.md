# Slim heroes, TV ticker, stronger CTAs

Date: 2026-09-07  
Task: TASK-20260907-003  
Branch: `ai/TASK-20260907-003-slim-hero-cta`

## Brief

Make wholesale and retail campaign banners slimmer to current storefront practice, keep every banner on that size, add a looping TV-style ticker on both homes, and strengthen page CTAs. No invented promotions.

## Evidence used

- Current heroes were `82–92vh` / `860px` (almost a full viewport). Artwork used `192/85`.
- Website hero standard in the banner skill: `1920×600–1080`. Lower bound is the modern fashion/IR pattern (Digikala/Banimode-class ~400–560px).
- Baymard / landing patterns: a full-viewport hero hides catalog; one primary CTA; contrast ≥7:1 on the action.
- Vercel Web Interface Guidelines: pause control for motion >5s; `transform`/`opacity` only; reduced motion.
- Anthropic `frontend-design` (174k★) + Vercel `web-design-guidelines` (30k★) installed under `.cursor/skills/`.
- `ui-ux-pro-max` suggested a red conversion palette; rejected — Taranom forest/gold stays.

## Architecture

| Decision | Choice | Why |
| --- | --- | --- |
| Hero size | Shared `.storefront-hero-frame`: mobile `2:1` max 232px, desktop `24:7` max 560px | One ratio for all campaign banners; smaller LCP paint; catalog enters the first screen |
| Image files | CSS `object-cover`, no re-encode | Performance-first; existing WebP plates crop to the new frame |
| Ticker | CSS loop in header on `/` and `/retail` only | No extra client JS; uses chrome announcement already fetched in layout |
| Ticker content | `tickerItems` → split `text` → verified defaults | CMS editable; no fake scarcity |
| CTA | Same buttons, action-named labels, min-h 48px | H2H; live CMS copy is not overwritten by migration |
| Scope | Storefront UI only | No API/auth/payment change |

## Invariants kept

- Slide 0 remains the only LCP / priority image.
- Home product cap stays ≤12.
- No new npm dependency.
- Reduced motion stops the ticker.
- Retail ticker never mentions MOQ ۶ عدد.

## Rollback

Revert the branch. CMS `tickerItems` is additive; missing field falls back to text/defaults.
