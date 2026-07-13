# Worklog — پلتفرم ترنم B2B

> **قانون پروژه:** بعد از هر تغییر معنادار (با Cursor یا Claude Code)، یک ورودی در این فایل و در صورت نیاز یک گزارش جلسه در `docs/reports/` اضافه شود. سپس commit در git.

## نحوه ثبت (برای AI و توسعه‌دهنده)

1. یک بلوک جدید با تاریخ ISO و عنوان کوتاه اضافه کنید.
2. فایل‌های تغییر یافته، deploy، تست و موارد باقی‌مانده را بنویسید.
3. برای جلسات بزرگ: `docs/reports/YYYY-MM-DD-<topic>.md` بسازید و از اینجا لینک دهید.
4. `git add` + `git commit` با Conventional Commits.

---

## 2026-07-13 — شروع ارتقای Wholesale Ordering (baseline قبل از تغییرات)

### Scope / Baseline
- **صفحه محصول (انتخاب رنگ/سایز + variant-based cart)**: `apps/web/src/components/wholesale/ProductDetail.tsx`
- **سبد خرید (localStorage)**: `apps/web/src/lib/cart.tsx`
- **checkout (تک‌صفحه‌ای + روش ارسال/پرداخت هاردکد)**: `apps/web/src/app/checkout/page.tsx`
  - Shipping: `CHAPAR`, `TIPAX`, `POST`, `IN_PERSON`
  - Payment: `CREDIT`, `BANK_TRANSFER`, `CHECK`, `CASH`
  - ارسال سفارش: `POST /orders` با `productVariantId`, `color`, `size`
- **API سفارش (تنها چک stock؛ بدون enforce MOQ سمت سرور)**: `apps/api/src/modules/order/order.service.ts`
- **مدل variant (color/size رشته‌ای + stock روی variant)**: `apps/api/src/modules/product/entities/product-variant.entity.ts`
- **Settings (ذخیره در `app_settings` JSONB)**: `apps/api/src/modules/settings/settings.service.ts`
  - Shipping methods فعلی در settings فقط enable-flag دارد (لیست شرکت‌ها dynamic نیست)

### یادداشت اجرای پروژه
- از این نقطه به بعد هر فاز: update `docs/WORKLOG.md` + در صورت نیاز report + commit جدا.

---

## 2026-07-13 — فاز 2: روش‌های ارسال/پرداخت + قوانین اقساط

### خلاصه
- Shipping از حالت ثابت خارج شد و **لیست شرکت‌های حمل قابل مدیریت** از پنل ادمین شد (ذخیره در `app_settings.shipping.companies`).
- Checkout روش‌های ارسال را از API می‌گیرد (`GET /shipping/methods`).
- روش‌های پرداخت checkout فقط:
  - `CASH` (نقدی)
  - `INSTALLMENT` (اقساطی)
- قوانین اقساط از پنل ادمین قابل تنظیم شد:
  - حداقل پیش‌پرداخت درصدی / مبلغی
  - حداکثر ماه اقساط
- اعتبارسنجی اقساط در **فرانت** و **API** اضافه شد.

### فایل‌های کلیدی
- `apps/api/src/modules/settings/settings.service.ts`
- `apps/api/src/modules/settings/settings.controller.ts`
- `apps/api/src/modules/shipping/shipping.service.ts`
- `apps/api/src/modules/order/order.service.ts`
- `apps/web/src/components/admin/AdminSettings.tsx`
- `apps/web/src/app/checkout/page.tsx`

---

## 2026-07-11 — سایت down — redeploy کامل سرور

**گزارش:** [reports/2026-07-11-server-redeploy.md](./reports/2026-07-11-server-redeploy.md)

### خلاصه
- علت: پوشه `/opt/taranom` و همه containerهای ترنم از سرور حذف شده بودند
- redeploy از GitHub + SSL + docker compose up
- دیتابیس و MinIO volume جدید → داده‌های قبلی (محصولات/عکس‌ها) از بین رفته
- schema bootstrap + seed ادمین انجام شد
- سایت: `https://poshaktaranom.com` → HTTP 200

### ادمین
- `/admin/login` — `09152424624` / `Admin@1234` (رمز را عوض کنید)

### اقدام لازم
- محصولات را دوباره از پنل ادمین اضافه کنید
- backup منظم postgres + minio

---

## 2026-07-09 — تصاویر محصول، صفحه جزئیات، مسیر خرید، deploy

**گزارش کامل:** [reports/2026-07-09-product-images-checkout-deploy.md](./reports/2026-07-09-product-images-checkout-deploy.md)

### خلاصه
- رفع باگ ذخیره نشدن عکس محصول در پنل ادمین
- ریسایز خودکار عکس با sharp (WebP، ۳:۴، ۱۲۰۰×۱۶۰۰)
- رفع دفرمه شدن گالری صفحه محصول
- تکمیل مسیر سبد → checkout → ثبت سفارش
- رفع باگ بحرانی JWT (`sub` / `customerId`) در ثبت سفارش
- deploy روی `poshaktaranom.com` و تست E2E موفق

### Deploy
- سرور: `/opt/taranom` — `ssh -p 2222 wholesale-admin@5.75.200.102`
- آخرین rebuild: api + web (۲۰۲۶-۰۷-۰۹)

### تست E2E
- اسکریپت: `scripts/e2e-purchase-test.sh`
- نتیجه: `ORD-2026-00002` — `PENDING_REVIEW`

### باقی‌مانده
- عکس‌های قدیمی (قبل از sharp) نیاز به آپلود مجدد دارند
- پرداخت آنلاین زرین‌پال فقط از پنل مشتری (فاکتورها)
- migrationهای واقعی DB

---

<!-- الگوی ورودی بعدی:

## YYYY-MM-DD — عنوان

**گزارش:** [reports/...](...)

### خلاصه
- ...

-->
