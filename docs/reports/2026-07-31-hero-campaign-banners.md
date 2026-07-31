# بارگذاری شش بنر Hero عمده و تک‌فروشی

**تاریخ:** 2026-07-31  
**کانال‌ها:** WHOLESALE و RETAIL  
**وضعیت:** پیاده‌سازی محلی؛ deploy انجام نشده

## هدف

کلاژ تأییدشده کاربر به سه اسلاید عمده و سه اسلاید تک‌فروشی تبدیل و با رعایت SEO، performance، responsive behavior، CMS و accessibility در Hero صفحه اصلی استفاده شود.

## تصمیم پیاده‌سازی

- پنل‌های ستون چپ به WHOLESALE و ستون راست به RETAIL تخصیص یافتند؛ ترتیب از بالا به پایین حفظ شد.
- برش‌ها deterministic انجام شدند؛ هیچ تصویر یا متن با AI بازتولید نشد تا artwork تغییر نکند.
- فایل‌ها WebP و کمتر از ۱۰۳KB هستند؛ نسخه موبایل مستقل ۳۷–۵۱KB دارد.
- حالت اسلاید `artwork` اضافه شد. در دسکتاپ artwork کامل بدون scrim و متن تکراری نمایش داده می‌شود و کل بنر لینک واقعی است.
- در موبایل، crop تصویری بدون نوشته نمایش داده می‌شود و H1/body/CTA واقعی HTML روی آن قرار می‌گیرد.
- متن معنایی، alt توصیفی، H1 و لینک keyboard-focusable حفظ شدند؛ متن داخل bitmap جایگزین HTML نشده است.
- autoplay با `prefers-reduced-motion` سازگار بود و اکنون دکمه توقف/ادامه صریح نیز دارد.
- dots از semantics ناقص tab به button group با `aria-current` تبدیل شدند.

## فایل‌های اصلی

- `apps/web/public/banners/hero-campaign-2026/*`
- `apps/web/src/lib/cms/hero-slides.ts`
- `apps/web/src/lib/cms/defaults.ts`
- `apps/web/src/components/wholesale/HeroSection.tsx`
- `apps/web/src/components/retail/RetailHero.tsx`
- `apps/web/src/components/shared/HeroCarousel.tsx`
- `apps/web/src/components/cms/block-shared.tsx`
- `apps/web/src/components/admin/AdminBlockEditor.tsx`
- `apps/api/src/database/migrations/20260731-001-hero-campaign-banners.ts`

## CMS و migration

تغییر defaults برای production کافی نیست، زیرا `site_contents` منتشرشده بر fallback اولویت دارد. migration جدید:

1. props قبلی Hero هر کانال را در جدول backup اختصاصی ذخیره می‌کند.
2. فقط Hero صفحه `home` را جایگزین می‌کند و سایر blockها را حفظ می‌کند.
3. `down` محتوای قبلی Hero را از backup بازمی‌گرداند و جدول backup را حذف می‌کند.

Migration/deploy روی production بدون تأیید مالک اجرا نشود.

## SEO و Performance

- پیام هر اسلاید در HTML موجود است و تنها به متن تصویری وابسته نیست.
- altها توصیفی و channel-specific هستند.
- اسلاید اول `priority` و `fetchPriority=high` دارد؛ بقیه priority ندارند.
- ابعاد desktop ثابت `1536×680` است تا CLS در تعویض اسلاید ایجاد نشود.
- CTA تک‌فروشی از `/products` استفاده می‌کند تا routing دامنه `.ir` و canonical صحیح باقی بماند.

## محدودیت شناخته‌شده

فایل منبع یک کلاژ ۱۵۳۶×۱۰۲۴ بود و هر پنل حدود ۷۶۷px عرض واقعی داشت. resize کیفیت جزئیات جدید ایجاد نمی‌کند. برای نمایش Retina ایده‌آل باید شش source مستقل حداقل ۱۹۲۰×۸۰۰ یا artwork بدون متن دریافت شود. این محدودیت مانع استفاده فعلی نیست، اما باید در نسخه بعدی کمپین رفع شود.

## Verification

- `npm run type-check --workspace=@taranom/web` — موفق
- `npx tsc --noEmit -p apps/api/tsconfig.json` — موفق
- `npm run build --workspace=@taranom/web` — موفق؛ ۶۰ مسیر تولید شد
- `git diff --check` — موفق
- مرورگر دسکتاپ `1440×900`: هر دو کانال، H1 واحد، بدون overflow افقی، artwork کامل و کنترل‌ها صحیح
- مرورگر موبایل `390×844`: source موبایل `600×800` انتخاب شد، H1 و CTA HTML قابل مشاهده و بدون overflow افقی
- تصاویر desktop بین ۷۴ تا ۱۰۳KB و تصاویر mobile بین ۳۷ تا ۵۱KB هستند.
- migration در production اجرا نشد؛ فقط TypeScript آن validate شد.
