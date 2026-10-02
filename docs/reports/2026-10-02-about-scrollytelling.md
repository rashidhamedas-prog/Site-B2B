# 2026-10-02 — Wholesale About scrollytelling redesign

## Goal
Replace the failed absolute-fade sticky About story with a modern sticky-graphic scrollytelling section.

## Approach
- Pattern: Scrollama-style sticky visual + scrolling step panels (IntersectionObserver)
- Intro (H1 + lede) outside the sticky track
- Four discrete atelier scene layers (fabric → cut → sew → wholesale ready)
- Progress rail on desktop; step dots on mobile
- No GSAP / Framer / Three.js; brand forest/gold/cream

## Skills / research
- skill-top **full**
- frontend-design, brand, design-system, ui-ux-product-design
- Refs: russellsamora/scrollama, GoogleChrome modern-web-guidance scrollytelling, MDN CSS scroll-driven animations (used as guidance; IO fallback chosen for Safari/stage index)

## Files
- `apps/web/src/components/wholesale/about/AboutExperience.tsx`
- `apps/web/src/components/wholesale/about/AboutStory.tsx`
- `apps/web/src/components/wholesale/about/AboutScene.tsx`
- `apps/web/src/components/wholesale/about/about.module.css`

## Validation
- `cd apps/web && npx tsc --noEmit` — pass
- Independent verify specialist: sticky+IO, intro outside, mobile, reduced-motion, brand — pass; mid-session reduced-motion IO teardown fixed after review

## Residual
- Optional later: CSS `animation-timeline: view()` progressive enhancement for layer fades where supported
- Visual QA on live `.com/about` after deploy
