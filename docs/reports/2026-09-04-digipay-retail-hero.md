# بنر دیجی‌پی هیرو فروشگاه تکی

**تاریخ:** 2026-09-04  
**تسک:** TASK-20260904-004  
**کانال:** RETAIL فقط

## هدف

بازطراحی بنر شریک دیجی‌پی طوری که متن فارسی داخل بیت‌مپ نباشد، عکس alt داشته باشد، و از CMS هیرو تکی قابل ویرایش باشد.

## تصمیم‌ها

- تصویر فقط فضای بصری است (زن + گوشی/کارت سه‌بعدی، بدون حرف). تیتر، توضیح، CTA و نام فروشگاه HTML هستند.
- اسلاید اول هیرو تکی با `presentation: overlay` و `overlayTone: light` تا ظاهر روشن بنر اصلی حفظ شود و اسلایدهای محصول همچنان تیره/طلایی بمانند.
- CTA همان «مشاهده محصولات» به `/products` است.
- متن کمپین از بنر مالک آمده؛ نرخ قسط، مدت، یا موجودی اعتبار اختراع نشد.
- تغییر `defaults.ts` برای سایت زنده کافی نیست؛ migration اسلاید را به `site_contents` تکی prepend می‌کند و بقیه اسلایدها را نگه می‌دارد.

## فایل‌ها

- `apps/web/public/banners/digipay-installment-2026/retail-desktop.webp` (۱۶۰۰×۹۰۰، ۴۶۷۳۸ بایت)
- `apps/web/public/banners/digipay-installment-2026/retail-mobile.webp` (۹۰۰×۱۶۰۰، ۳۷۱۹۲ بایت)
- `apps/web/src/lib/cms/hero-slides.ts` + spec
- `apps/web/src/components/retail/RetailHero.tsx`
- `apps/web/src/components/shared/HeroCarousel.tsx` (tone `ink`)
- `apps/web/src/components/admin/AdminBlockEditor.tsx`
- `apps/api/src/database/migrations/20260904-004-digipay-retail-hero.ts`

## ریسک

دیجی‌پی در چک‌اوت فقط اگر اعتبارنامه UPG کامل باشد دیده می‌شود. بنر اطلاع‌رسانی کمپین است، نه فعال‌سازی درگاه. قرارداد BNPL داخلی ترنم نیست؛ انتخاب قسط روی صفحه میزبان دیجی‌پی است اگر برای مشتری فعال باشد.

## Rollback

`down` migration هیرو را از جدول backup برمی‌گرداند. حذف اسلاید از `/admin/site-content` هم کافی است.
