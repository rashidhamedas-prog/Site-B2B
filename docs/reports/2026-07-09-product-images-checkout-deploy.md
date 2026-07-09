# گزارش جلسه — تصاویر، checkout، deploy و تست E2E

| فیلد | مقدار |
|------|--------|
| **تاریخ** | ۲۰۲۶-۰۷-۰۹ |
| **پروژه** | Taranom B2B — `poshaktaranom.com` |
| **مسیر محلی** | `d:\soft\claud\porje\Site BtoB` |
| **مسیر سرور** | `/opt/taranom` |
| **Stack** | Next.js 15 + NestJS 10 + PostgreSQL + MinIO + Meilisearch + Docker |

---

## ۱. درخواست‌های کاربر (به ترتیب)

1. بررسی کل پروژه و رفع ایرادات
2. عکس محصول آپلود می‌شود ولی ذخیره نمی‌شود
3. deploy روی سرور (پارس آپتایم)
4. رفع SSH timeout (پورت ۲۲۲۲)
5. ریسایز استاندارد عکس + دفرمه شدن صفحه محصول + بررسی مسیر خرید تا پرداخت
6. تست end-to-end مسیر خرید
7. گزارش کامل در پروژه و git (این سند)

---

## ۲. ایرادات شناسایی و رفع‌شده

### ۲.۱ باگ اصلی — عکس ذخیره نمی‌شد (ادمین)

**علت:** در `AdminProducts.tsx`، تابع `handleSave` از state `images` استفاده می‌کرد اما `images` در dependency array مربوط به `useCallback` نبود → همیشه آرایه خالی `[]` به API ارسال می‌شد.

**رفع:** اضافه کردن `images` به deps و استفاده از hook آپلود.

| فایل | تغییر |
|------|--------|
| `apps/web/src/components/admin/AdminProducts.tsx` | رفع deps + ذخیره images |
| `apps/web/src/lib/hooks/useImageUpload.ts` | hook جدید آپلود |
| `apps/web/src/lib/api.ts` | `uploadImage()` |
| `apps/api/src/modules/upload/storage.service.ts` | MinIO upload/delete |
| `apps/api/src/modules/upload/image-processor.ts` | ریسایز sharp → WebP |
| `apps/api/Dockerfile` | `vips-dev` برای sharp |
| `docker-compose.yml` | `MINIO_PUBLIC_URL` |
| `.env.example` | متغیرهای MinIO عمومی |

### ۲.۲ ریسایز خودکار عکس

**استاندارد سایت:**
- نسبت **۳:۴**
- حداکثر **۱۲۰۰×۱۶۰۰** پیکسل
- خروجی **WebP** کیفیت ۸۲٪
- چرخش خودکار EXIF (`rotate()`)

**نکته:** فقط آپلودهای **جدید** پردازش می‌شوند. عکس‌های `.jpg` قبلی باید دوباره آپلود شوند.

### ۲.۳ دفرمه شدن صفحه محصول

**علت:** `next/image` با `fill` بدون container با `position: relative` و aspect ratio ثابت.

**رفع:**
- کامپوننت `ProductImage` در `apps/web/src/components/ui/ProductImage.tsx`
- بازنویسی `ProductDetail.tsx` با `aspect-[3/4]`، thumbnail grid، `max-h-[70vh]`
- لینک `FeaturedProducts`: `/products/${id}` → `/products/${slug}`
- پشتیبانی slug و UUID در `fetchProduct`

### ۲.۴ مسیر خرید (سبد → checkout → سفارش)

| بخش | فایل | تغییر |
|-----|------|--------|
| سبد | `apps/web/src/lib/cart.tsx` | persistence در `localStorage`، فیلد `imageUrl` |
| checkout | `apps/web/src/app/checkout/page.tsx` | نمایش عکس، روش ارسال/پرداخت |
| API سفارش | `apps/api/src/modules/order/order.service.ts` | هماهنگی هزینه ارسال، بررسی stock، کسر موجودی |
| صفحه محصول | `ProductDetail.tsx` | اعتبارسنجی موجودی vs حداقل سفارش |

**هزینه ارسال (frontend + backend):**
- جمع زیر ۵۰٬۰۰۰٬۰۰۰ ریال (۵M تومان) → ۱٬۵۰۰٬۰۰۰ ریال (۱۵۰K تومان)
- بالای آن → رایگان

**پرداخت در checkout:** انتخاب روش (نسیه، کارت به کارت، چک، نقد) — **نه** درگاه آنلاین لحظه‌ای.

**پرداخت آنلاین (زرین‌پال):** از `portal/dashboard/payments` پس از صدور فاکتور.

### ۲.۵ باگ بحرانی — ثبت سفارش 500

**علت:** `JwtStrategy.validate()` فقط `{ id, phone, role, customerId }` برمی‌گرداند؛ کنترلر سفارش `req.user.sub` می‌خواند → `undefined` → `customerId` null در INSERT.

**رفع:**
- `apps/api/src/modules/auth/strategies/jwt.strategy.ts` — اضافه شدن `sub: user.id`
- `apps/api/src/modules/order/order.controller.ts` — استفاده از `req.user.customerId` + پیام خطای واضح

**تأیید:** سفارش‌های تست `ORD-2026-00001` و `ORD-2026-00002` با موفقیت ثبت شدند.

---

## ۳. سایر اصلاحات (فاز اول پروژه)

| موضوع | جزئیات |
|--------|--------|
| امنیت ادمین | `RolesGuard` + `@Roles('ADMIN')` روی endpointهای حساس |
| DTO محصول | validation در create/update |
| Meilisearch | `SearchService`, `SearchModule`, سرویس docker |
| حذف orphan | فایل MinIO هنگام حذف/ویرایش محصول |
| بلاگ ادمین | آپلود `coverImage` |
| Migration infra | `data-source.ts` |
| FeaturedProducts | نمایش عکس از API |

---

## ۴. استقرار (Deploy)

### دسترسی سرور
```bash
ssh -i ~/.ssh/wholesale_server -p 2222 wholesale-admin@5.75.200.102
cd /opt/taranom
```

### روش deploy (بدون git روی سرور)
```bash
# از ویندوز — آپلود فایل‌های تغییر یافته
scp -P 2222 <file> wholesale-admin@5.75.200.102:/opt/taranom/<path>

# روی سرور
docker compose build api web
docker compose up -d api web
curl -sf http://localhost:4000/v1/health
```

### سرویس‌های فعال (آخرین بررسی)
- `taranom_api`, `taranom_web`, `taranom_postgres`, `taranom_redis`
- `taranom_minio`, `taranom_meili`, `taranom_nginx`

### env مهم سرور
```
MINIO_PUBLIC_URL=https://poshaktaranom.com/media
MEILI_HOST=http://meilisearch:7700
NEXT_PUBLIC_API_URL=https://poshaktaranom.com/api/v1  # یا api subdomain
```

### نکات deploy اول
- ماژول‌های orphan سرور (`health`, `jobs`, `audit`, ...) build را خراب می‌کردند → حذف شدند
- SSH: پورت ۲۲۲۲ از پنل پارس آپتایم / فایروال باز شد

---

## ۵. تست‌ها

### تست خودکار E2E
```bash
# روی سرور
bash scripts/e2e-prep.sh          # آماده‌سازی داده تست (اختیاری)
bash scripts/e2e-purchase-test.sh # مسیر کامل API
```

**مراحل تست:**
1. Health API
2. دریافت محصول + variant با stock
3. endpoint slug → 200
4. login مشتری
5. POST `/orders`
6. لیست سفارش‌ها
7. صفحات web `/products`, `/checkout`

**نتیجه نهایی:** `=== E2E PASSED ===`

### تست HTTP دستی
- `/products` → 200
- `/checkout` → 200
- `/api/v1/health` → ok

### تست دستی پیشنهادی (مرورگر)
1. `/products` → کلیک محصول → بررسی گالری
2. انتخاب رنگ/سایز → افزودن به سبد → refresh (سبد بماند)
3. `/checkout` → ثبت سفارش (نیاز به login پنل)
4. آپلود عکس جدید در ادمین → بررسی `.webp`

---

## ۶. فهرست فایل‌های کلیدی تغییر یافته

```
apps/web/src/components/admin/AdminProducts.tsx
apps/web/src/components/wholesale/ProductDetail.tsx
apps/web/src/components/wholesale/ProductCatalog.tsx
apps/web/src/components/wholesale/FeaturedProducts.tsx
apps/web/src/components/ui/ProductImage.tsx
apps/web/src/lib/cart.tsx
apps/web/src/lib/api.ts
apps/web/src/lib/hooks/useImageUpload.ts
apps/web/src/app/checkout/page.tsx

apps/api/src/modules/upload/image-processor.ts
apps/api/src/modules/upload/storage.service.ts
apps/api/src/modules/order/order.service.ts
apps/api/src/modules/order/order.controller.ts
apps/api/src/modules/auth/strategies/jwt.strategy.ts
apps/api/Dockerfile

docker-compose.yml
.env.example

scripts/e2e-purchase-test.sh
scripts/e2e-prep.sh
scripts/e2e-debug-*.sh
```

---

## ۷. کارهای باقی‌مانده

- [ ] آپلود مجدد عکس‌های قدیمی برای WebP استاندارد
- [ ] اسکریپت batch تبدیل عکس‌های موجود در MinIO (اختیاری)
- [ ] migrationهای واقعی schema (به‌جای synchronize)
- [ ] تست پرداخت زرین‌پال در پنل مشتری با merchant واقعی
- [ ] راه‌اندازی git remote و CI/CD
- [ ] حذف سفارش‌های تست E2E از DB اگر لازم است (`ORD-2026-00001/00002`)

---

## ۸. یادداشت برای Claude Code / Cursor

- قبل از edit: `docs/WORKLOG.md` و آخرین گزارش `docs/reports/` را بخوانید.
- بعد از edit: ورودی WORKLOG + commit.
- Bootstrap: `CLAUDE.md` و `.claude/memory.json`.
- deploy: `deploy.sh` و `TARANOM-SERVER-INFO.txt`.

---

*تهیه‌شده: ۲۰۲۶-۰۷-۰۹ — جلسه Cursor Agent*
