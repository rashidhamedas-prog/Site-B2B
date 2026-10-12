# Sales partners notice desk redesign (2026-10-12)

Task: `TASK-20261012-003` · Depth: skill-top **full**

## Goal

بازطراحی تب «اطلاع‌رسانی» ادمین همکاران بازاریاب به‌صورت میز عملیات ۲۰۲۶: compose + پیش‌نمایش زنده بنر همکار + تأیید قبل از broadcast + تاریخچه با متریک.

## Scope

- File: `apps/web/src/components/admin/sales-partners/SpNoticeDesk.tsx`
- API unchanged: `GET/POST /admin/sales-partners/notices`, `POST …/:id/archive`

## Design direction

Dense RTL ops desk (forest `#1B5C4A` / gold focus `#C9A84C`). Not marketing UI. Preview mirrors `SalesPartnerNotices` `TONE_CLASS` / `TONE_LABEL` (اطلاع / مهم / فوری).

## Changes

1. Two-column compose | sticky live preview on `lg+`
2. Confirm-before-send strip (focus moved into panel)
3. Progressive disclosure for link + expiry
4. History tabs: فعال / آرشیو + MetricTriplet (مخاطب / دیده / بسته)
5. History rows use partner tone surfaces

## Research / skills

- Repos/patterns: PageSpace broadcast composer (preview + confirm), Wexio audience count, shared-features priority banners
- Skills: skill-top, ECC `frontend-design-direction`, project `frontend-design`, `ui-ux-product-design`
- Slack search (public + private): no product thread found for این تب
- Slack API `chat.postMessage`: documented; **out of scope** (in-app banner only)

## Validation

- `npx tsc --noEmit` in `apps/web`: exit 0
- Independent review: PASS WITH CONDITIONS → majors fixed (preview «همه اطلاعیه‌ها» removed; focus on confirm panels)

## Non-goals (unchanged)

Email/SMS/Slack delivery, audience segments, rich text, new dependencies.
