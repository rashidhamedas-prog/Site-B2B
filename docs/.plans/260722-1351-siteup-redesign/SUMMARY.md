# Plan: Taranom siteup.md Redesign & Optimization

**Source:** `c:\Users\DayaTech\Desktop\Skill ERP\siteup.md`  
**Started:** 2026-07-22  
**Mode:** Batch phases with Persian checkpoint after each  
**Design direction:** Soft UI / Trust & Authority (emerald+gold locked) + glass tokens evolution (choice 1-A)

## Decisions

| Decision | Choice |
|----------|--------|
| Glass vs Soft UI | Keep Soft UI brand; add glass blur/translucent tokens |
| Scope | All 5 sections as ordered phases |
| Font | Keep Vazirmatn (already SEO-ready) |
| WP Admin references | Map to NestJS settings + Next admin panel |
| 21st theme publish | Ask user before public publish |

## Phases

- [x] Phase 0 — Plan bootstrap
- [x] Phase 1 — Landing glass UI + Theme Settings admin (`theme` settings group)
- [ ] Phase 2 — Dynamic menus + Mega Menu + Linen Collection landing
- [ ] Phase 3 — SEO-friendly product filters (fabric/size/color) + glass sidebar/drawer
- [ ] Phase 4 — PDP structured fields + SEO description placement
- [ ] Phase 5 — Schema / E-E-A-T / technical SEO / product SEO panel

## Progress

- **2026-07-22 13:51** — Plan created; Phase 1 started (glass tokens + theme settings).
- **2026-07-22 14:05** — Phase 1 complete. Verified: `tsc --noEmit` api+web exit 0. Glass utilities, Modal/Why/CTA, theme API group, admin tab, ThemeRuntime+LandingPopups.

## Surprises & Discoveries

- ui-ux-pro-max suggested rose/pink palette — ignored; brand colors stay locked.
- No local workshop hero images in `public/`; custom image via theme URL only.
- `Product` / `BreadcrumbList` JsonLd helpers exist but are unused on PDP.

## Decision Log

- Glass blur default `12px`, admin-adjustable via `theme.glassBlurPx`.
- Theme group key: `theme` in `app_settings`.
- Popups: boutique lead + newsletter; trigger delay or exit-intent; localStorage dismiss.

## Outcomes & Retrospective

_(filled at end)_
