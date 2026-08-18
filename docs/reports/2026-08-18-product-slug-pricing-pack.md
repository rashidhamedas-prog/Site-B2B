# گزارش: اصلاح slug، قیمت/تخفیف مستقل، پک، متن و محصولات مرتبط

تاریخ: 2026-08-18  
شاخه: `ai/TASK-20260818-001-product-slug-pricing-pack`  
وظیفه: `TASK-20260818-001`

## Readiness (قبل از کد)

- ریپو Git فعال: `D:\soft\Claud\porje\Site B2B` روی `master` در `305969e`. مسیر `Site BtoB` لمس نشد.
- استک: Next.js 15 + NestJS 10 + TypeORM/PostgreSQL. SSR محصول از `API_INTERNAL_URL` (`http://api:4000/v1`) استفاده می‌کند.
- شکاف قطعی slug: به‌روزرسانی محصول و نوشتن `seo_redirects` اتمیک نبود؛ خطای flatten زنجیره swallow می‌شد؛ lookup ریدایرکت `revalidate: 60` داشت و miss را cache می‌کرد.
- تخفیف: قیمت‌های نهایی/compare-at جدا بودند ولی فلگ/درصد/پنجره مشترک بود.
- MOQ: `minOrderQty` پیش‌فرض/کف ۶ + `allowBelowMoq`؛ سبد عمده از قبل «تعداد پک» بود.
- متن و مرتبط: ستون‌ها موجود بودند؛ مولد و job تکمیل تا ۵ نبود.

## آنچه پیاده شد

### ۱) Slug اتمیک
تغییر slug داخل یک transaction قفل می‌شود، normalize/validate می‌شود، سپس محصول و ریدایرکت‌های ۳۰۱ هر دو کانال با هم نوشته می‌شوند. زنجیره `A→B→C` به `A→C` و `B→C` جمع می‌شود. شکست نوشتن ریدایرکت slug را rollback می‌کند. lookup ویترین `cache: no-store` است.

### ۲) قیمت و تخفیف
فرم اصلی فقط دو قیمت پایه دارد. تخفیف تک و عمده مستقل است (درصد/مبلغ ثابت/بازه، در صورت فعال بودن همان کانال). سرور قیمت نهایی و compare-at را از پایه محاسبه می‌کند. `isDiscounted` مشتق OR است.

ستون‌های کانال **nullable** اضافه شدند تا بدون backfill، محصولات قدیمی از `isDiscounted` مشترک ارث ببرند. هیچ UPDATE تخفیف روی production در این مهاجرت اجرا نمی‌شود.

### ۳) پک / MOQ
`minOrderQty` = حداقل تعداد پک (حداقل ۱، پیش‌فرض محصولات جدید ۱). `allowBelowMoq` از UI/DTO/سرویس حذف شد (ستون DB باقی است تا synchronize دراپ نکند). تعداد هر پک = رنگ‌های متمایز × سایزهای `sizeType`. سفارش عمده quantity را پک می‌گیرد و به ماتریس رنگ×سایز expand می‌کند. مقادیر فعلی `minOrderQty` بازنویسی نشدند.

### ۴) متن تخصصی
مولد deterministic فارسی بدون LLM. دکمه‌های ادمین متن را فقط با کلیک در textarea می‌گذارند. CLI `job:content` پیش‌فرض dry-run است و متن دستی را overwrite نمی‌کند.

### ۵) مرتبط
سقف ۵؛ روابط دستی حفظ و کمبود تکمیل می‌شود. CLI `job:related` پیش‌فرض dry-run.

## Migration / rollback

- فایل: `apps/api/src/database/migrations/20260818-001-product-channel-sale-pack.ts`
- `up`: ADD COLUMN nullable برای تخفیف کانال + DEFAULT `minOrderQty` به ۱ (بدون UPDATE ردیف‌های موجود)
- `down`: DROP همان ستون‌ها + DEFAULT minOrderQty به ۶
- Safety-net: `scripts/apply-production-schema.sql`

## Dry-run داده‌ای production — هنوز اجرا نشده

قبل از `--apply` روی VPS این‌ها لازم است:

1. Backup دیتابیس
2. تأیید صریح مالک
3. `cd apps/api && npm run job:minpack-report` (فقط‌خواندنی)
4. `npm run job:content` سپس در صورت تأیید `--apply` یا `--replace-legacy-only --apply`
5. `npm run job:related` سپس در صورت تأیید `--apply`
6. SQL پیشنهادی backfill تخفیف (فقط ردیف‌های unambiguous) بعد از backup:

```sql
UPDATE products
SET "wholesaleIsDiscounted" = true
WHERE COALESCE("isDiscounted", false) = true
  AND "wholesaleCompareAtPrice" > "wholesalePrice"
  AND "wholesalePrice" > 0
  AND "wholesaleIsDiscounted" IS NULL;
-- مشابه برای retail؛ ردیف‌های مبهم را حدس نزنید.
```

`--force` محتوا و `--replace` مرتبط بدون preview ممنوع است.

## تست‌های اجراشده

| فرمان | نتیجه |
|---|---|
| `apps/api` `npm test` | exit 0 |
| `apps/api` `npx tsc --noEmit` | exit 0 |
| `apps/web` `npx tsc --noEmit` | exit 0 |
| production smoke / deploy | پس از merge |

Build کامل turbo در این جلسه جداگانه زمان‌بر است؛ typecheck وب+API سبز بود.

## اقدام مالک

- Backup قبل از apply مهاجرت روی VPS (مهاجرت schema-only است ولی احتیاط الزامی است)
- تأیید backfill تخفیف کانال و jobهای content/related
- تصمیم برای محصولات با `minOrderQty=6`: الان یعنی ۶ پک؛ اگر باید ۱ پک شوند باید جداگانه و با گزارش dry-run اصلاح شوند
- تست زنده یک slug آزمایشی روی `.ir` و `.com` بعد از deploy (نه محصول مشتری بدون هماهنگی)
