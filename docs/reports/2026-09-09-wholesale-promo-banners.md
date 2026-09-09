# SEO/GEO Decision Report — poshaktaranom.com wholesale home heroes — 2026-09-09

## Executive outcome

دو بنر artwork روی هیروی صفحهٔ اصلی عمده قرار گرفتند تا درخواست همکاری و دستهٔ کت بدون ساخت URL جدید دیده شوند. پیام داخل تصویر است؛ HTML و alt همان پیشنهاد بنر را برای خزش و دسترس‌پذیری نگه می‌دارند.

## Scope & evidence

- Markets/locales/templates: wholesale home `https://poshaktaranom.com/` (`fa`, B2B)
- Mode: `implement` (نه audit کامل سایت)
- Retail `.ir` و فایل‌های TASK-20260909-011 دست نخورده ماندند
- Official changes revalidated: N/A برای این اسلایس (بدون تغییر robots/canonical/schema type)

## Page contract

| نوع URL | intent | ارزش متمایز | مسیر | indexability | canonical | schema |
| --- | --- | --- | --- | --- | --- | --- |
| هوم عمده | تامین بوتیک / شروع همکاری | هیروی موجود | `/` | index | self `https://poshaktaranom.com` | بدون schema بنر جدا |
| ثبت همکاری | لید B2B | فرم موجود | `/portal/register` | موجود | self | N/A این اسلایس |
| دسته کت | انتخاب مدل کت عمده | دسته موجود `women-coats` | `/category/women-coats` | موجود | self | Breadcrumb/Product موجود |

صفحهٔ جدید ساخته نشد. لینک CTA به `.ir` نمی‌رود.

## Architecture

- ماژول: CMS `site_contents` WHOLESALE/`home` + `HeroSection`
- مالک داده: ادمین `/admin/site-content`؛ migration فقط prepend می‌کند
- رندر: SSR/ISR 60s؛ اسلاید ۰ LCP با preload موجود
- امنیت: بدون auth/secret؛ مسیرها نسبی همان‌هاست
- Rollback: `down` هیرو را از backup برمی‌گرداند؛ حذف فایل‌های WebP

## Findings / delivery

| ID | P | change | acceptance |
| --- | --- | --- | --- |
| W-01 | P1 | اسلاید همکاری + کت در هیرو عمده | لینک واقعی، alt توصیفی، artwork دسکتاپ |
| W-02 | P2 | defaults.ts به‌خاطر claim تسک ۰۱۱ به‌روز نشد | HeroSection plates را اعمال می‌کند؛ بعد از آزاد شدن defaults یک خط fallback کافی است |

## Performance

- دسکتاپ: ۱۹۲۰×۵۶۰ WebP q92 (حدود ۱۱۶KB و ۸۷KB)
- موبایل: ۱۲۰۰×۶۰۰؛ `priority` فقط اسلاید ۰
- CLS: همان `.storefront-hero-frame`

## QA & release decision

Gateها پس از اجرای تست در همین جلسه ثبت می‌شوند. نمایش rich result یا رتبه تضمین نشده است.

## Measurement and next review

بعد از deploy: TTFB هوم `.com`، وجود اسلاید ۰ در HTML، کلیک CTA به `/portal/register` و `/category/women-coats`. بازبینی: یک هفته پس از انتشار.
