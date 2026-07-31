# بازطراحی Human-centered بنرهای Hero

**تاریخ:** 2026-07-31

**کانال‌ها:** WHOLESALE و RETAIL
**وضعیت:** روی production منتشر و تأیید شد (`ed612da`)

## علت بازطراحی

نسخه کلاژی از نظر رنگ و تقسیم کانال قابل استفاده بود، اما برای خروجی حرفه‌ای نهایی مناسب نبود: رزولوشن هر پنل حدود ۷۶۷px، متن و CTA حک‌شده داخل bitmap، typography ناهماهنگ، mobile crop ضعیف و وابستگی SEO به تصویر.

## راه‌حل

- شش plate انسانی اصلی موجود در `assets/banners/hero-2026` جایگزین artwork کلاژی شدند.
- سه تصویر برای عمده و سه تصویر برای تکی با لحن و copy مخصوص هر کانال تنظیم شدند.
- نسخه desktop مستقل `1600×900` و mobile مستقل `900×1200` ساخته شد.
- متن، H1/H2، body و CTA کاملاً HTML و قابل ویرایش از CMS هستند.
- یک H1 پایدار و مخفی بصری برای intent صفحه وجود دارد؛ تیتر متغیر اسلایدها H2 است، بنابراین carousel هیچ‌گاه صفحه را بدون H1 نمی‌گذارد.
- `autoplayMs` به ۶۵۰۰ افزایش یافت؛ pause/resume و reduced-motion حفظ شدند.
- تصاویر تزئینی alt خالی دارند تا متن heading برای screen reader تکرار نشود.
- migration `20260731-002-human-hero-redesign.ts` props قبلی Hero را backup و فقط Hero صفحات home را جایگزین می‌کند؛ down محتوای قبلی را بازمی‌گرداند.

## سلسله‌مراتب طراحی

- تصویر انسانی و محصول در نیمه چپ/میانی؛ فضای امن متن RTL در سمت راست.
- eyebrow کوتاه، heading حداکثر سه خط، body کوتاه و CTA واحد با اولویت روشن.
- عمده: سبز تیره و طلایی، پیام‌های واقعی درباره ویترین، حداقل سفارش و پشتیبانی.
- تکی: زمینه ادیتوریال آرام و پیام پوشیدنی/روزمره، بدون ادعای تخفیف یا urgency ساختگی.
- متن داخل تصویر، badge شناور، آمار و ادعاهای تأییدنشده حذف شدند.

## ابزارهای طراحی متصل

- Canva Image-to-Design برای تبدیل کلاژ به فایل خارجی editable درخواست شد، اما guard ایمنی ارسال فایل منتشرنشده را بدون تأیید جداگانه مالک متوقف کرد؛ فایل ارسال نشد.
- اتصال Adobe/Photoshop در مرحله initialization پاسخ 403 داد و قابل استفاده نبود.
- Figma نیازمند ارسال/capture دارایی یا صفحه به سرویس خارجی است و تا دریافت تأیید صریح مالک انجام نشد.
- همه پردازش‌های نهایی داخل repository و بدون خروج دارایی انجام شدند.

## فایل‌ها

- `apps/web/public/banners/hero-human-2026/*`
- `apps/web/src/lib/cms/defaults.ts`
- `apps/web/src/components/wholesale/HeroSection.tsx`
- `apps/web/src/components/retail/RetailHero.tsx`
- `apps/api/src/database/migrations/20260731-002-human-hero-redesign.ts`

## محدودیت و مرحله بعد

یک subject کت کرم در دو plate با پس‌زمینه متفاوت تکرار شده و تصاویر عمده همگی مدل‌محورند. برای نسخه ممتاز B2B، یک عکس واقعی انسانی از کارگاه/کنترل کیفیت/رگال سفارش یا بسته‌بندی ترنم دریافت و جایگزین شود. تا دریافت عکس واقعی، copy فعلی فقط درباره محصول و همکاری قابل اثبات صحبت می‌کند.

## Verification

### Final checks (Cursor handoff)

- `npm.cmd run type-check --workspace=@taranom/web`: passed.
- `npx.cmd tsc --noEmit -p apps/api/tsconfig.json`: passed.
- `npm.cmd run build --workspace=@taranom/web`: passed (60 routes generated).
- `npm.cmd run build --workspace=@taranom/api`: passed.
- `git diff --check`: passed.
- Root `npm run lint`: blocked by the pre-existing missing API `eslint` executable/dependency.
- Root `npm test`: blocked by the pre-existing missing API `jest` executable/dependency.
- Browser desktop at 1440x900: exactly one H1 on both channels, no horizontal overflow, desktop WebP selected.
- Browser mobile at 390x844: exactly one H1 on both channels, no horizontal overflow, dedicated `-mobile.webp` selected.
- Retail mobile review exposed a low-contrast heading; `text-white` was added explicitly to `RetailHero` before handoff.
- Production deploy completed successfully at commit `ed612da`.
- TypeORM migrations `HumanHeroRedesign1785456000002` and `HeroCampaignBanners1785456000001` are recorded in production.
- Production API `/v1/health`: passed.
- Desktop production: all three hero images loaded at 1200px intrinsic width; retail heading computed color is white.
- Mobile production at 390x844: dedicated mobile WebP selected on `.com` and `.ir`, exactly one H1, and no horizontal overflow.

### Production hotfix: high-DPR desktop images

- A real 1920px Chrome session exposed missing hero photos while text and gradients remained visible.
- Root cause: Next Image accepted `w=1920` but returned HTTP 400 for the `w=3840` candidate selected on wide/high-DPR displays.
- The human hero assets are already compressed WebP files (roughly 32-80KB), so these specific local files now use Next Image `unoptimized` mode and are served directly.
- CMS/external and legacy hero images retain the existing optimizer behavior; the bypass is scoped to `/banners/hero-human-2026/`.

### SSH / deployment handoff

- The production key remains outside Git at the standard path `C:\Users\DayaTech\.ssh\wholesale_server`.
- `C:\Users\DayaTech\.ssh\config` defines `Host wholesale-vps` for `wholesale-admin@5.75.200.102:2222`, with `IdentitiesOnly yes` and password authentication disabled.
- `ssh -T -o BatchMode=yes -o ConnectTimeout=8 wholesale-vps exit`: passed.
- Never copy the private key into this repository or commit it. GitHub `origin` remains independent from the VPS deployment key.

نتایج typecheck/build و بررسی مرورگر پس از اجرا در انتهای همین گزارش ثبت شوند.
