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

این بخش بعد از deploy تکمیل می‌شود. ادعای بهبود ۲۸روزهٔ میدانی CWV نمی‌شود.

### چک‌لیست ops

- Health `/v1/health`
- هوم/کاتالوگ/PDP تک و عمده
- login/checkout `no-store`
- feedها
- `require('sharp')` داخل `taranom_api`
- dry-run backfill، سپس `--limit=1` با manifest کپی‌شده روی هاست
- Cloudflare `.ir` فقط بعد از پایدار شدن origin؛ HTML/API/admin/account/checkout کش نمی‌شود

## Rollback

- revert ریلیز و migration هیرو
- `--rollback=<manifest>` یا بازیابی `payload` از `product_image_backfill_manifests`
- اصل تصاویر در MinIO می‌ماند
- رکوردهای `.ir` با TTL 300 به DNS-only برمی‌گردند
