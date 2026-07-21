# گزارش جلسه — بازطراحی UI سایت عمومی ترنم

**تاریخ:** 2026-07-21  
**موضوع:** نصب ui-ux-pro-max + بازطراحی بصری سایت wholesale

## خلاصه

Skill [ui-ux-pro-max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) با CLI در `.cursor/skills/` نصب شد. Design system در `design-system/default/` با هویت برند سبز/طلایی ترنم (نه پالت navy خام skill) قفل شد. کل سطح عمومی `(wholesale)` با الگوی Trust & Authority + Soft UI Evolution بازطراحی شد.

## تصمیم‌ها

| موضوع | تصمیم |
|--------|--------|
| دامنه | سایت عمومی (نه ادمین/پورتال) |
| رنگ | Primary `#1B5C4A` / Secondary `#C9A84C` |
| فونت | Vazirmatn (RTL) |
| Hero | full-bleed؛ بدون badge شناور و آمار داخل viewport اول |

## ترتیب صفحه اصلی

Hero → Trust strip → WhyTaranom → Featured → ComingSoon → HowItWorks → Testimonials → CTA

## فایل‌های مهم

- `design-system/default/MASTER.md`, `pages/home.md`
- `apps/web/src/app/globals.css`, `tailwind.config.ts`
- `apps/web/src/components/layout/*`, `components/wholesale/*`
- `apps/web/src/app/(wholesale)/**`

## تست

- `tsc --noEmit` در `apps/web` — پاس

## باقی‌مانده

- بررسی بصری دستی روی 375/768/1024/1440
- deploy به production در صورت تأیید مالک
