# بنرهای رویه ۲۰۲۶ — تک و عمده

## نتیجه

برای هوم خرده‌فروشی و عمده‌فروشی دو hero مستقل از تصاویر واقعی محصول ساخته شد. متن، CTA و عنوان‌ها در HTML باقی می‌مانند؛ تصاویر فقط artwork محصول‌اند. ترتیب اسلایدها اکنون از CMS می‌آید و کد دیگر کمپین‌های قدیمی را قبل از اسلاید اول ادمین تزریق نمی‌کند.

Figma: [Taranom — Outerwear Heroes 2026](https://www.figma.com/design/yoWEk4wuQNRjU3wUU3hVdn)

## طراحی و assets

- Retail: کاپشن شتری؛ Wholesale: کاپشن قهوه‌ای.
- Desktop: `1920×560`.
- Mobile: `1200×960` مطابق قاب واقعی `5 / 4`.
- فرمت: WebP، نام cache-busted.
- حجم‌ها: 19,470 تا 29,324 بایت؛ سقف قرارداد 400KB.
- ترکیب: مدل در سمت چپ، فضای متن RTL در سمت راست، بدون متن حک‌شده، badge یا تخفیف ساختگی.
- مسیر live: `apps/web/public/banners/outerwear-2026/`.
- نسخه آرشیو: `assets/banners/hero-2026/`.

## قرارداد CMS

`RETAIL/home`:

- headline: `لایه‌ای گرم، استایلی آرام`
- image: `/banners/outerwear-2026/retail-desktop-180617246c9c.webp`
- mobile: `/banners/outerwear-2026/retail-mobile-180617246c9c.webp`
- CTA: `مشاهده جدیدترین‌ها` → `/products`
- `presentation=overlay`, `overlayTone=dark`, `copySide=start`

`WHOLESALE/home`:

- headline: `لایه فصل، ویترین شما`
- image: `/banners/outerwear-2026/wholesale-desktop-9d541eef7362.webp`
- mobile: `/banners/outerwear-2026/wholesale-mobile-9d541eef7362.webp`
- CTA: `دیدن مدل‌های عمده` → `/products`
- CTA دوم: `شروع همکاری از ۶ عدد` → `/portal/register`
- `presentation=overlay`, `overlayTone=dark`, `copySide=start`

## SEO، دسترس‌پذیری و performance

- H1 پایدار صفحه و headline اسلایدها جدا می‌مانند.
- alt توصیفی CMS در هر دو کانال رندر می‌شود.
- `<picture>` نسخه desktop/mobile را با media query انتخاب می‌کند.
- preload دستی حذف شد تا asset نامتناسب viewport دوباره دانلود نشود.
- فقط اسلاید صفر `eager` و `fetchPriority=high` است؛ اسلایدهای بعدی lazy/auto هستند.
- URL و متن CTA لینک HTML واقعی و قابل‌خزش است.

## شواهد

- baseline پیش از تغییر: health و هر دو home برابر 200؛ هر home یک preload تصویر داشت.
- `page-hero-policy.spec.mts`: PASS.
- `hero-slides.spec.ts`: PASS.
- `wholesale-promo-slides.spec.ts`: PASS.
- `StorefrontHeroMedia.spec.tsx`: PASS.
- Web TypeScript: PASS.
- Web build: compile/type stage PASS؛ static generation به‌علت timeout موجود در `/portal/register` و چند route ادمین/پرتال FAIL شد؛ هیچ failure به hero نسبت داده نشد.
- `git diff --check`: PASS.
- Independent review: PASS؛ بدون blocker.
- Ship (2026-10-12): PR #81 merge `e48db3f7`؛ VPS tip `59c2ad1`؛ health 200.
- Admin CMS: `WHOLESALE/home` و `RETAIL/home` اسلاید ۰ outerwear ذخیره و خوانده شد.
- Live public HTML: `.ir` و `.com` اسلاید ۰ outerwear؛ WebPها 200؛ browser QA eager/high بدون preload تکراری.
- بسته شد: claims آزاد.

## منابع بازاعتبارسنجی‌شده

- Google Images SEO: alt توصیفی، متن پیرامونی مرتبط و تصاویر responsive.
- Google mobile-first: برابری alt و کیفیت تصویر در موبایل/دسکتاپ.
- web.dev LCP/fetchpriority: تصویر LCP در HTML اولیه، بدون lazy؛ از preload تکراری پرهیز شود.
- Shopify 2026 hero guidance: پیام کوتاه، CTA روشن، کنترل حرکت و کنتراست.

## rollback

در ادمین، اسلاید قبلی را دوباره به جایگاه اول برگردانید و revalidate کنید. برای rollback کد، commit این task را revert کنید؛ assets هش‌دار مستقل‌اند و حذف فوری آن‌ها لازم نیست.
