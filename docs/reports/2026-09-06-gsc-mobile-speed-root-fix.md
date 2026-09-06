# رفع ریشه‌ای سرعت موبایل تک و عمده

تاریخ: ۲۰۲۶-۰۹-۰۶  
شاخه: `ai/TASK-20260903-004-gsc-mobile-speed-v2`  
تسک: `TASK-20260903-004`

## مبنای قبل از تغییر

- Search Console برای `poshaktaranom.com` در ۵ سپتامبر: گروه ۱۰ URL موبایل با LCP `3.7s` و INP `212ms`.
- دامنه `.ir` هنوز CrUX کافی ندارد؛ سنجش آزمایشگاهی است.
- کاتالوگ سرد `www.poshaktaranom.ir/products`: LCP تا `12.232s` به‌خاطر remount بعد از hydration.
- PDP سارا: LCP `5.508s` چون مبدأ JPEG حدود `3.68MB` بود.
- از ۵۹ تصویر اصلی فعال، ۴۲ فایل بالای `500KB`. علت: `sharp` در runtime کانتینر resolve نمی‌شد و fallback بی‌صدا اصل فایل را ذخیره می‌کرد.

## تغییرات کد

1. `apps/api/Dockerfile`: overlay ماژول‌های workspace-local تا `require('sharp')` از `/app/dist` کار کند.
2. `image-processor.ts`: fail-closed، WebP حداکثر ۱۲۰۰×۱۶۰۰، `limitInputPixels`.
3. `backfill-product-images.ts`: DataSource مستقل (بدون AppModule/migration/scheduler)، dry-run پیش‌فرض، `--apply` فقط با manifest خارج از `/tmp`، قفل مشورتی، به‌روزرسانی تراکنشی، بدون حذف اصل، بدون outbox. Registry فقط `INSERT … ON CONFLICT DO NOTHING`.
4. PDP عمومی: `next.revalidate = 60`؛ قیمت و موجودی سفارش همچنان سمت سرور محاسبه می‌شود.
5. یک فونت variable رسمی + مجوز OFL؛ GTM بعد از load/paint یا تعامل با سقف ۸ ثانیه.
6. هیروی عمده: فایل هش‌دار + migration فقط روی URL اسلایدهای منطبق؛ rollback فیلدبه‌فیلد.
7. کلید hydration کاتالوگ پایدار؛ فقط تصویر کارت اول صفحهٔ کاتالوگ high/eager؛ prefetch کارت‌ها خاموش؛ بنر دسته `fetchPriority=low`.
8. Backfill: `Not Found` در MinIO = `source-missing`؛ تصویر خراب/غیرقابل‌پردازش = `source-unprocessable`. آپلود جدید همچنان fail-closed است.

## بازبینی

- Reviewer: PASS WITH CONDITIONS (`d334e021`)
- Security: PASS WITH CONDITIONS (`bab82642`)
- FAIL اولیهٔ backfill (`17bf1d52`) بسته شد: AppModule، manifest موقت، URL خارجی، rollback غیردقیق هیرو، و overwrite آلت.

## تست مشاهده‌شده

| فرمان | نتیجه |
|--------|--------|
| `image-processor.spec.ts` | ok |
| `backfill-product-images.spec.ts` | ok |
| `20260906-004-wholesale-hero-cache-bust.spec.ts` | ok |
| `catalog-performance.spec.ts` | ok |
| `apps/api` `tsc --noEmit` | 0 |
| `apps/web` `tsc --noEmit` | 0 |

بیلد محلی Next یک‌بار به‌خاطر دو `next build` هم‌زمان روی `.next` شکست خورد؛ بیلد معتبر همان بیلد Docker روی VPS است.

## انتشار و سنجش زنده

SHA زنده: `ca1bdd8`. ادعای بهبود ۲۸روزهٔ میدانی CWV نمی‌شود.

### Ops مشاهده‌شده

| بررسی | نتیجه |
|--------|--------|
| `/v1/health` روی origin `:4000` | 200 `{"status":"ok"}` |
| `require('sharp')` در `taranom_api` | `0.33.5` / vips `8.15.3` |
| هوم `.ir` / `.com` | 200؛ TTFB origin حدود `0.31s` / `0.42s` |
| `/account` تکی | 200 (مسیر `/account/login` روی `.ir` 404 است) |
| `/checkout` تکی | 200، `private, no-cache, no-store`، `cf-cache-status: DYNAMIC` |
| فید `/v1/feeds/torob.xml` تکی و عمده | 200 |
| sitemap `.ir` و `.com` | 200 |
| هیروی عمده | `/banners/hero-product-2026-v2/wholesale-01-mobile-8c90e6ac4182.webp` |

### Backfill

- Dry-run (`/home/wholesale-admin/product-image-backfill/dry-20260906.json`): ۶۰ محصول، ۵۵۴ ارجاع، ۲۲۸ URL یکتا، ۱۷۰ واجد شرایط. ۱۶۹ جایگزینی آماده (حدود ۵۵۷MB → ۱۵MB). ۵۸ skip: ۵۷ زیر آستانهٔ ۵۱۲KB، ۱ `source-missing`. ۱ خطا: `products/1785328613890-812046da22911.jpg` دقیقاً `5242880` بایت و `Product image processing failed` (JPEG ناقص؛ در `ca1bdd8` skip با `source-unprocessable`).
- `--limit=1 --apply`: محصول `wool-coat-katayoun` تصویر اول `3,795,161` → `119,458` WebP (`products/optimized/12ce141b3f68d6574e3aba47.webp`). ۱ ارجاع عوض شد.
- Apply باقی (`apply-rest-20260906.json`، کپی هاست `$HOME/product-image-backfill/`): `status=applied`، ۱۶۹ واجد شرایط، ۱۶۸ جایگزینی، ۰ خطا، ۶۰ skip (۵۸ آستانه، ۱ `source-missing`، ۱ `source-unprocessable` همان JPEG ۵MB). `changedReferences=440`. حدود ۵۵۴MB → ۱۵MB. اصل فایل‌ها در MinIO ماند؛ outbox نوشته نشد.
- جمع دو apply: ۱۶۹ تصویر بهینه‌شده، ۴۴۱ ارجاع.

### Cloudflare `.ir` (حساب `36a2cb50a339ec81a878dde07cdec1ea`)

- SSL: Full (strict).
- قانون «Cache public storefront HTML» خاموش شد.
- قانون فعال «Cache static media and next image»: `/_next/static/*`، `/_next/image*`، `/banners/*`، `/fonts/*` و پسوندهای استاتیک. query string برای `/_next/image` حفظ می‌شود.
- DNS نارنجی فقط A اپکس و www به `5.75.200.102`. MX/TXT/`_acme-challenge` خاکستری ماندند.
- شواهد زنده از origin: HTML هوم/کاتالوگ/حساب `DYNAMIC`؛ فونت Vazirmatn بار دوم `HIT`.

### پروفایل آزمایشگاهی موبایل

شرایط: `390×844`، DPR 2، Slow 4G (`150ms` / `196608` down / `96000` up)، CPU×4، cache مرورگر disabled. LCP از `PerformanceObserver` با `buffered`. اجرای اول سردتر است؛ اجراهای بعدی لبهٔ CF گرم‌ترند. اجرای کاتالوگ تکی r2 هنگام ریستارت/بار backfill نویز داشت (`TTFB 7.5s`).

| صفحه | TTFB (ms) | FCP (ms) | LCP (ms) | میانه LCP | منبع LCP |
|------|-----------|----------|----------|-----------|----------|
| هوم تکی `www.poshaktaranom.ir/` | 735 / 213 / 204 | 6328 / 1556 / 960 | 6960 / 1940 / 1044 | **1940** | `banners/digipay-installment-2026/retail-mobile.webp` |
| هوم عمده `poshaktaranom.com/` | 764 / 271 / 296 | 2364 / 1456 / 1212 | 2680 / 1588 / 1296 | **1588** | `wholesale-01-mobile-8c90e6ac4182.webp` |
| کاتالوگ تکی `/products` | 389 / 7515 / 251 | 2016 / 8868 / 1768 | 3348 / 9420 / 2268 | **3348** | کارت اول via `/_next/image` JPEG |
| کاتالوگ عمده `/products` | 1444 / 391 / 374 | 2768 / 2068 / 1760 | 4452 / 3184 / 3140 | **3184** | کارت via `/_next/image` JPEG |
| PDP سارا تکی | 542 / 513 / 420 | 2060 / 1616 / 1692 | 4760 / 1616 / 1860 | **1860** | `1787993393583-071436a8a7ffb.jpg` w=828 |
| PDP سارا عمده | 278 / 448 / 382 | 1828 / 1876 / 1796 | 4528 / 3592 / 4512 | **4512** | `1787994011222-f508abcb99eb3.jpg` w=828 |

مبنا: کاتالوگ سرد تکی `12.232s`؛ سارا `5.508s` با JPEG حدود `3.68MB`. هوم‌ها و سارا تکی زیر آستانهٔ آزمایشگاهی `2.5s` آمدند. کاتالوگ و سارا عمده در همین سه اجرا هنوز بالای `2.5s` بودند چون سنجش قبل از apply باقی‌مانده بود. بعد از apply، HTML هر دو PDP سارا و کتایون `products/optimized/*.webp` دارند و JPEG قدیمی در HTML نیست؛ اصل JPEG در MinIO هنوز 200 است.

### Search Console

حساب `rashidhamedas@gmail.com`، ملک `sc-domain:poshaktaranom.com`. گروه موبایل: ۱۰ URL، ۲ مسئله. آخرین به‌روزرسانی CrUX ۵ سپتامبر ۲۰۲۶.

- INP > 200ms: Validation **Started** (`item_key=CAUQAhgC`).
- LCP > 2.5s: Validation **Started** (`item_key=CAMQAhgC`).
- LCP > 4s: ۰ URL — Validate نشد.
- Validate Fix برای redirect/noindex/404 زده نشد.

## Rollback

- revert ریلیز و migration هیرو
- `--rollback=<manifest>` یا بازیابی `payload` از `product_image_backfill_manifests`
- اصل تصاویر در MinIO می‌ماند
- رکوردهای `.ir` با TTL 300 به DNS-only برمی‌گردند
