# Phase 1 — page-scoped campaign heroes

Task: TASK-20260912-002  
Date: 2026-09-12

## Problem

`HeroSection` and `RetailHero` always prepended home campaign plates. Inner CMS pages (contact, wholesale terms, about on retail, boutique) showed the homepage banner.

## Change

- `CmsPage` wraps renderers in `CmsPageScope({ channel, pageKey })`.
- `shouldInjectHomeCampaign` is true only for `pageKey === 'home'`. Missing scope fails closed.
- Inner pages do not fall back to `/retail/hero-model.webp` or DigiPay plates.
- Inner page H1 is the page headline, not the home sr-only H1.

## Gates

- `page-hero-policy.spec.mts` OK
- `locale.spec.mts` OK
- `apps/web` `tsc --noEmit` 0

## Not in this deploy

- Category Persian name/slug (Phase 3)
- Product multi-category membership (Phase 4)
- Wiring `shapeDigitsInText` through stats UI (Phase 2; helper is in `@taranom/persian-utils`)
