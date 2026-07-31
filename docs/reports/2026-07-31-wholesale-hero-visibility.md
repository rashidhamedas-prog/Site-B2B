# رفع دیده نشدن بنر هیرو عمده

**تاریخ:** 2026-07-31

## مشکل

سه بنر کمپین محصول (`hero-product-2026-v2`) برای عمده در CMS و مسیر `/banners/...` بارگذاری و سرو می‌شدند، ولی در ویترین `poshaktaranom.com` دیده نمی‌شدند. تکی (`poshaktaranom.ir`) درست بود.

## علت

1. `HeroSection` عمده برای حالت `overlay` تصویر را با `opacity-40` نشان می‌داد.
2. روی تصویر یک لایهٔ تقریباً مات `bg-gradient-hero-soft` (گرادیان سبز تیرهٔ opaque) نشسته بود.
3. بنرهای عمده خودشان خیلی تیره‌اند (میانگین روشنایی حدود ۳۰–۸۴)، برخلاف بنرهای تکی (~۱۷۰+).

نتیجه: فقط متن و زمینهٔ سبز دیده می‌شد؛ عکس هیرو عملاً محو بود.

## اصلاح

- opacity اسلاید فعال → `100%` (مثل RetailHero)
- جایگزینی wash مات با scrim نیمه‌شفاف RTL برای خوانایی متن بدون پوشاندن بنر
- trim روی `imageUrl` / `mobileImageUrl` در `normalizeHeroSlides` (رفع فاصلهٔ انتهایی در mobile اسلاید ۲ production)

## فایل‌ها

- `apps/web/src/components/wholesale/HeroSection.tsx`
- `apps/web/src/lib/cms/hero-slides.ts`
