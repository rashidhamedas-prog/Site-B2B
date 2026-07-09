# پوشاک ترنم — پلتفرم عمده‌فروشی

سایت B2B عمده‌فروشی تولیدی ترنم — Next.js 15 + NestJS 10 + PostgreSQL

---

## ساختار پروژه

```
Site BtoB/
├── apps/
│   ├── web/          # Next.js 15 (frontend)
│   └── api/          # NestJS 10 (backend)
├── packages/
│   ├── shared-types/ # TypeScript types مشترک
│   └── persian-utils/# ابزارهای فارسی (Jalali، IRR)
├── nginx/            # Nginx reverse proxy config
├── docs/             # WORKLOG، گزارش جلسات، قراردادها
├── scripts/          # تست E2E و ابزار deploy
├── docker-compose.yml
└── .env.example
```

## مستندات و گزارش کار

| فایل | کاربرد |
|------|--------|
| [docs/WORKLOG.md](./docs/WORKLOG.md) | خلاصه زمانی همه تغییرات |
| [docs/reports/](./docs/reports/) | گزارش تفصیلی هر جلسه |
| [docs/conventions.md](./docs/conventions.md) | قانون به‌روزرسانی بعد از هر تغییر (Cursor / Claude Code) |

---

## راه‌اندازی محلی (Development)

```bash
# 1. نصب وابستگی‌ها
npm install

# 2. کپی فایل env
cp .env.example .env
# مقادیر واقعی را در .env وارد کنید

# 3. اجرای دیتابیس‌ها، MinIO و Meilisearch
docker compose up postgres redis minio minio-init meilisearch -d

# 4. اجرای API
cd apps/api && npm run start:dev

# 5. اجرای Frontend (در ترمینال جدید)
cd apps/web && npm run dev
```

دسترسی:
- Frontend: http://localhost:3000
- API: http://localhost:4000
- Swagger: http://localhost:4000/api/docs
- MinIO Console: http://localhost:9001 (برای مدیریت فایل‌ها)
- Meilisearch: http://localhost:7700 (جستجوی محصولات)

---

## ساخت Admin اولیه

```bash
cd apps/api
npm run seed
```

اعتبارنامه پیش‌فرض:
- شماره: `09152424624`
- رمز: `Admin@1234`
- **بعد از اول login، رمز را عوض کنید!**

---

## Migration دیتابیس (Production)

در development از `synchronize` استفاده می‌شود. برای production:

```bash
cd apps/api
npm run migration:generate   # بعد از تغییر entityها
npm run migration:run        # اجرای migrationها
```

فایل تنظیمات: `apps/api/src/database/data-source.ts`

---

```bash
# 1. آماده کردن .env
cp .env.example .env
# تمام CHANGE_ME ها را با مقادیر واقعی جایگزین کنید

# 2. ساخت و اجرا
docker compose up -d --build

# 3. ساخت admin اولیه
docker compose exec api node -e "
  const {NestFactory} = require('@nestjs/core');
  // یا از طریق seed script
"

# 4. بررسی وضعیت
docker compose ps
docker compose logs api --tail=50
```

---

## آدرس‌های سایت

| محیط | آدرس |
|------|-------|
| سایت عمده | https://poshaktaranom.com |
| API | https://api.poshaktaranom.com |
| Swagger | https://api.poshaktaranom.com/api/docs |
| MinIO Console | http://SERVER_IP:9001 |

---

## نقشه صفحات

### عمومی
- `/` — صفحه اصلی
- `/products` — کاتالوگ محصولات  
- `/products/[slug]` — جزئیات محصول
- `/about` — درباره ترنم
- `/contact` — تماس
- `/wholesale` — شرایط عمده‌فروشی

### پنل مشتری (`/portal`)
- `/portal/login` — ورود
- `/portal/register` — ثبت‌نام عمده‌فروش
- `/portal/dashboard` — داشبورد
- `/portal/dashboard/orders` — سفارش‌ها
- `/portal/dashboard/invoices` — فاکتورها
- `/portal/dashboard/payments` — پرداخت‌ها
- `/portal/dashboard/profile` — پروفایل
- `/checkout` — سبد خرید و ثبت سفارش

### پنل ادمین (`/admin`)
- `/admin/login` — ورود ادمین
- `/admin` — داشبورد
- `/admin/customers` — مشتریان (CRM)
- `/admin/orders` — سفارش‌ها
- `/admin/orders/[id]` — جزئیات سفارش
- `/admin/products` — محصولات
- `/admin/inventory` — انبار
- `/admin/invoices` — فاکتورها
- `/admin/reports` — گزارش‌ها
- `/admin/users` — کاربران ادمین
- `/admin/settings` — تنظیمات

---

## API Endpoints

همه endpoints از `/v1/` شروع می‌شوند. مستندات کامل در Swagger.

| متد | مسیر | توضیح |
|-----|------|--------|
| POST | `/v1/auth/register` | ثبت‌نام مشتری |
| POST | `/v1/auth/login` | ورود |
| GET | `/v1/auth/me/profile` | پروفایل کاربر |
| GET | `/v1/products` | لیست محصولات |
| GET | `/v1/products/slug/:slug` | محصول با slug |
| GET | `/v1/orders` | سفارش‌ها |
| POST | `/v1/orders` | ثبت سفارش |
| GET | `/v1/invoices` | فاکتورها |
| GET | `/v1/customers` | مشتریان (ادمین) |
| GET | `/v1/dashboard` | آمار داشبورد |
| GET | `/v1/inventory` | موجودی انبار |
