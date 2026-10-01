# گزارش: کنتراست هیرو همکار بازاریاب + بنر

تاریخ: 2026-10-01  
تسک: TASK-20261001-004

## مشکل

روی `/sales-partnership` تیتر و بخشی از متن روی پس‌زمینهٔ سبز تیره (`--retail-primary-dark`) تقریباً مشکی دیده می‌شد و خوانایی نداشت.

## ریشه

در `apps/web/src/app/globals.css` برای همهٔ `h1–h6` رنگ `var(--color-gray-900)` اجباری است. `text-white` روی `<section>` به فرزندان heading ارث نمی‌رسد چون خود heading رنگ صریح دارد. الگوی درست قبلاً در `RetailHero` با `!text-white` رعایت شده بود؛ CTA/process لندینگ همکار آن را نداشتند.

## اصلاح

1. `RetailCtaBanner`: `!text-white` روی تیتر و بدنه؛ پشتیبانی `imageUrl`/`imageAlt` با `next/image` fill + گرادیان تیره برای خوانایی.
2. `RetailProcessSteps`: `!text-white` روی h2/h3 و متن‌ها.
3. بنر تولیدشده (سبز جنگلی + لینن/مد، بدون متن داخل تصویر) → `apps/web/public/sales-partner/hero-banner.webp` (~66KB, 1920×1080).
4. defaults `salesPartnership` و ادمین (`AdminBlockEditor`) فیلد تصویر پس‌زمینهٔ CTA را می‌گیرند.
5. `RetailBlocksRenderer` props تصویر را پاس می‌دهد؛ برای CTA با `headingAs=h1` و تصویر، `priority` برای LCP.

## اعتبارسنجی

- `apps/web` tsc: پاس
- پس از deploy: HTML زنده باید H1 با کلاس سفید و مسیر `/sales-partner/hero-banner.webp` داشته باشد.

## خارج از محدوده

- تغییر درصد پورسانت یا API
- بازطراحی پنل `/sales-partners` (TASK-003)
