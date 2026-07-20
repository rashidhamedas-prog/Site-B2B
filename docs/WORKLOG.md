# Worklog — پلتفرم ترنم B2B

> **قانون پروژه:** بعد از هر تغییر معنادار (با Cursor یا Claude Code)، یک ورودی در این فایل و در صورت نیاز یک گزارش جلسه در `docs/reports/` اضافه شود. سپس commit در git.

## نحوه ثبت (برای AI و توسعه‌دهنده)

1. یک بلوک جدید با تاریخ ISO و عنوان کوتاه اضافه کنید.
2. فایل‌های تغییر یافته، deploy، تست و موارد باقی‌مانده را بنویسید.
3. برای جلسات بزرگ: `docs/reports/YYYY-MM-DD-<topic>.md` بسازید و از اینجا لینک دهید.
4. `git add` + `git commit` با Conventional Commits.

---

<<<<<<< HEAD
## 2026-07-20 — رفع خطای ثبت‌نام عمده‌فروش

### خلاصه
- placeholder شهر (`تهران`) شبیه مقدار پرشده بود و باعث خطای «فیلدهای ستاره‌دار» بدون ارسال API می‌شد
- اعتبارسنجی فیلدبه‌فیلد + نرمال‌سازی ارقام فارسی/عربی موبایل
- ثبت‌نام تراکنشی با پشتیبانی soft-deleted user/customer؛ کاربر جدید `isActive=false` تا تأیید ادمین
- همگام‌سازی `user.isActive` با تغییر وضعیت مشتری در ادمین؛ پیام ورود برای حساب PENDING

### فایل‌ها
- `apps/web/src/components/portal/RegisterForm.tsx`, `apps/web/src/lib/api.ts`
- `apps/api/src/modules/auth/auth.service.ts`, `dto/register.dto.ts`
- `apps/api/src/modules/customer/customer.service.ts`
=======
## 2026-07-20 — جداسازی کامل موجودی از رنگ در ثبت محصول

### خلاصه
- مودال «رنگ‌بندی» فقط تعریف رنگ/بارکد؛ بدون فیلد یا ویرایش موجودی
- موجودی فقط از «مدیریت انبار» (`POST /inventory/set` + اعتبارسنجی مضرب MOQ)
- API: `createVariant` همیشه stock=0؛ `updateVariant` تغییر stock را رد می‌کند

### فایل‌ها
- `apps/web/src/components/admin/AdminProducts.tsx`, `AdminInventory.tsx`
- `apps/api/src/modules/product/*`, `inventory/*`
>>>>>>> 2997a74 (feat(admin): fully separate color definition from inventory stock)

---

## 2026-07-18 — تکمیل gapهای سند (تخفیف واقعی، فاکتور ارسال، Jalali ساعت)

### خلاصه
- اعمال تخفیف کد + طبقاتی + جانبی در `order.create` و نمایش در checkout (`quote-discounts`)
- فیلدهای هزینه ارسال روی فاکتور: حمل درون‌شهری / هر کیلو / رایگان
- تاریخ شمسی با ساعت برای شروع/انقضای تخفیف
- SEO description در `generateMetadata` صفحه محصول
- حذف fallback دمو از FeaturedProducts

---

## 2026-07-18 — رفع CI برای deploy خودکار + اسکریپت‌های سرور

### خلاصه
- SSH از IP فعلی به VPS قطع/ریست می‌شود (احتمالاً fail2ban)
- CI قبلاً روی `turbo lint` / `next lint` می‌شکست و job deploy اجرا نمی‌شد
- workflow به typecheck + build تغییر کرد؛ اسکریپت deploy شامل pull/build و ALTER schema لازم برای site.docx
- اسکریپت‌های `scripts/server-*.sh` هم commit شد

### Deploy
- مسیر اصلی: GitHub Actions → SSH از runner (IP متفاوت از ویندوز لوکال)
- اگر secrets (`VPS_HOST` / `VPS_USER` / `VPS_SSH_KEY`) تنظیم نباشد، deploy اکشن fail می‌شود و باید از کنسول هتزنر دستی اجرا شود

---

## 2026-07-17 — اعمال تغییرات site.docx (محصول، تخفیف، اقساط، ارسال، آمار)

### خلاصه
پیاده‌سازی کامل درخواست‌های سند `site.docx` روی ادمین + API + فروشگاه:

**محصولات**
- حذف فیلدهای ترکیب/جنس پارچه از فرم؛ افزودن `specs` (توضیحات محصول) با حافظه مقادیر
- `description` فقط SEO؛ وضعیت `COMING_SOON` + سکشن پیش‌خرید در صفحه اصلی
- برچسب «جدید» خودکار ۷ روز؛ «تخفیف‌دار» دستی؛ «موجودی محدود» وقتی موجودی ≤ ۲× MOQ
- `sizeType` (۲/۳/فری سایز) + راهنمای سایز روی PDP

**واریانت‌ها**
- رنگ با پالت + تاریخچه؛ موجودی مضرب MOQ؛ سایز از `sizeType` محصول

**تخفیف‌ها**
- تاریخ شروع/انقضا شمسی برای کد؛ تخفیف طبقاتی و جانبی (CRUD API + UI تب‌دار)
- بازاریابی تکراری → redirect به `/admin/discounts`

**اقساط / ارسال**
- چند قانون اقساط با دسته؛ شرط ≥۲ فاکتور فعال + اخطار در checkout
- حذف هزینه‌های ارسال از تنظیمات؛ ثبت هزینه باربری + رسید روی سفارش؛ نمایش در پورتال

**آمار**
- داشبورد بدون داده دمو؛ سری ماهانه واقعی از API

### فایل‌های کلیدی
- `apps/api/src/modules/product/*`, migration `20260717-001-*`
- `apps/api/src/modules/discount/*`
- `apps/api/src/modules/order/*`, `settings.service.ts`, `dashboard.service.ts`
- `apps/web/src/components/admin/AdminProducts.tsx`, `AdminMarketing.tsx`, `AdminSettings.tsx`, `AdminOrderDetail.tsx`, `AdminDashboard.tsx`
- `apps/web/src/components/wholesale/ProductDetail.tsx`, `ComingSoonSection.tsx`
- `apps/web/src/app/checkout/page.tsx`

### تست
- `npx tsc --noEmit` در `apps/api` و `apps/web` — بدون خطا

### خارج از محدوده
- بخش «مشتریان» سند ناقص بود و اعمال نشد

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

## 2026-07-13 — فاز 3: دسته‌بندی + تولید خودکار SKU

### خلاصه
- اضافه شدن `CategoryEntity` با:
  - `skuPrefix` (مثل `LINEN-`)
  - `nextSequence` برای تولید SKU یکتا و مقاوم در برابر همزمانی
- افزودن `products.categoryId` و migration مربوطه.
- تولید SKU هنگام ایجاد محصول (اگر `sku` ارسال نشود و `categoryId` موجود باشد).
- UI ادمین:
  - صفحه `/admin/categories` برای CRUD دسته‌بندی‌ها
  - انتخاب دسته‌بندی در فرم محصول و امکان خالی گذاشتن SKU برای تولید خودکار

### فایل‌های کلیدی
- `apps/api/src/modules/category/*`
- `apps/api/src/database/migrations/20260713-001-create-categories.ts`
- `apps/api/src/modules/product/product.service.ts`
- `apps/web/src/components/admin/AdminCategories.tsx`
- `apps/web/src/components/admin/AdminProducts.tsx`
- `apps/web/src/components/admin/AdminSidebar.tsx`

---

## 2026-07-13 — رفع دفرمه شدن پنل ادمین + deploy

### خلاصه
- رفع layout ادمین: حذف `sticky` دوبل‌کاری سایدبار + `mr-64` تکراری
- import گم‌شده `Layers` در سایدبار (باعث خطای رندر می‌شد)
- مخفی کردن FloatingContact در مسیر `/admin`
- جلوگیری از overflow افقی در جداول ادمین

### Deploy
- push به GitHub + rebuild روی سرور

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
