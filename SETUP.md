# راهنمای راه‌اندازی پروژه ترنم

---

## محیط توسعه (Windows — ماشین محلی)

### پیش‌نیازها
- Node.js 20+
- npm 10+
- PostgreSQL 16 (نصب مستقیم روی Windows)

### نصب وابستگی‌ها
```bash
cd "Site BtoB"
npm install
```

### نصب فونت وزیرمتن
فایل‌های زیر را از [vazirmatn releases](https://github.com/rastikerdar/vazirmatn/releases) دانلود و در `apps/web/public/fonts/` کپی کنید:
- `Vazirmatn-Regular.woff2`
- `Vazirmatn-Medium.woff2`
- `Vazirmatn-SemiBold.woff2`
- `Vazirmatn-Bold.woff2`
- `Vazirmatn-ExtraBold.woff2`

### متغیرهای محیطی (توسعه)
فایل `.env` در ریشه پروژه باید این مقادیر را داشته باشد:
```env
NODE_ENV=development
PORT=4000
DB_HOST=localhost
DB_PORT=5432
DB_USER=taranom
DB_PASS=taranom_pass
DB_NAME=taranom_db
DB_SSL=false
REDIS_PASS=
JWT_SECRET=taranom_jwt_super_secret_key_for_local_development_2026_minimum_64_chars_ok
JWT_EXPIRES=7d
NEXT_PUBLIC_API_URL=http://localhost:4000/v1
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_RETAIL_URL=http://localhost:3001
```

### اجرای محیط توسعه
```bash
# ترمینال ۱ — API
cd apps/api
npm run start:dev

# ترمینال ۲ — Next.js
cd apps/web
npm run dev
```

آدرس‌ها:
- سایت: `http://localhost:3000`
- API: `http://localhost:4000/v1`
- Swagger: `http://localhost:4000/api/docs`

### راه‌اندازی دیتابیس (اولین بار)
```
# ۱. ابتدا setup-database.bat را اجرا کنید (دوبار کلیک)
#    رمز عبور postgres را وارد کنید تا user و database ساخته شوند.

# ۲. start-api.bat را اجرا کنید
#    API اتصال به PostgreSQL برقرار می‌کند و جداول را auto-create می‌کند.

# ۳. setup-seed.bat را اجرا کنید
#    کاربر ادمین با اطلاعات زیر ایجاد می‌شود:
#    موبایل: 09152424624
#    رمز: Admin@1234
```

آدرس پنل ادمین: `http://localhost:4000/admin` → ورود با اطلاعات بالا

---

## استقرار تولید (سرور لینوکس + Docker)

### پیش‌نیازهای سرور
- Ubuntu 22.04 یا Debian 12
- Docker Engine + Docker Compose Plugin
- دسترسی SSH root

### ۱. نصب Docker روی سرور
```bash
curl -fsSL https://get.docker.com | bash
systemctl enable docker && systemctl start docker
```

### ۲. آپلود پروژه به سرور
```bash
# از ماشین Windows شما:
scp -r "D:\soft\claud\porje\Site BtoB" root@YOUR_SERVER_IP:/opt/taranom
```

### ۳. ساختن فایل .env روی سرور
```bash
ssh root@YOUR_SERVER_IP
cd /opt/taranom
cp .env.example .env
nano .env
```

مقادیر ضروری برای production:
```env
NODE_ENV=production
PORT=4000
DB_HOST=postgres
DB_PORT=5432
DB_USER=taranom
DB_PASS=YOUR_STRONG_DB_PASSWORD
DB_NAME=taranom_db
DB_SSL=false
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASS=YOUR_STRONG_REDIS_PASSWORD
JWT_SECRET=YOUR_VERY_LONG_RANDOM_SECRET_MIN_64_CHARS
JWT_EXPIRES=7d
NEXT_PUBLIC_API_URL=https://api.poshaktaranom.com/v1
NEXT_PUBLIC_SITE_URL=https://poshaktaranom.com
NEXT_PUBLIC_RETAIL_URL=https://poshaktaranom.ir
```

### ۴. دریافت گواهی SSL (Let's Encrypt)
قبل از راه‌اندازی Docker، DNS دامنه‌ها باید به IP سرور اشاره کنند.

```bash
apt install certbot -y

# دریافت گواهی برای poshaktaranom.com
certbot certonly --standalone \
  -d poshaktaranom.com -d www.poshaktaranom.com -d api.poshaktaranom.com \
  --email rashidhamedas@gmail.com --agree-tos --no-eff-email

# دریافت گواهی برای poshaktaranom.ir
certbot certonly --standalone \
  -d poshaktaranom.ir -d www.poshaktaranom.ir \
  --email rashidhamedas@gmail.com --agree-tos --no-eff-email

# کپی گواهی‌ها به پوشه nginx
mkdir -p /opt/taranom/nginx/ssl/poshaktaranom.com
mkdir -p /opt/taranom/nginx/ssl/poshaktaranom.ir

cp /etc/letsencrypt/live/poshaktaranom.com/fullchain.pem /opt/taranom/nginx/ssl/poshaktaranom.com/
cp /etc/letsencrypt/live/poshaktaranom.com/privkey.pem   /opt/taranom/nginx/ssl/poshaktaranom.com/
cp /etc/letsencrypt/live/poshaktaranom.ir/fullchain.pem  /opt/taranom/nginx/ssl/poshaktaranom.ir/
cp /etc/letsencrypt/live/poshaktaranom.ir/privkey.pem    /opt/taranom/nginx/ssl/poshaktaranom.ir/
```

### ۵. راه‌اندازی با Docker Compose
```bash
cd /opt/taranom
docker compose build
docker compose up -d
```

### ۶. بررسی وضعیت
```bash
docker compose ps
docker compose logs api --tail=50
docker compose logs web --tail=50
curl http://localhost:4000/v1/health
```

### ۷. ایجاد ادمین در production
```bash
# پیدا کردن container postgres:
docker compose exec postgres psql -U taranom -d taranom_db

# در psql:
INSERT INTO users (phone, email, "passwordHash", role, "isActive", "createdAt", "updatedAt")
VALUES (
  '09152424624',
  'rashidhamedas@gmail.com',
  '$2a$12$YOUR_BCRYPT_HASH_HERE',
  'ADMIN', true, NOW(), NOW()
);
\q
```

برای تولید hash:
```bash
docker run --rm node:20-alpine node -e \
  "require('bcryptjs').hash('Admin@1234',12).then(h=>process.stdout.write(h+'\n'))"
```

### ۸. تمدید خودکار SSL
```bash
# اضافه کردن cron job:
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet && \
  cp /etc/letsencrypt/live/poshaktaranom.com/*.pem /opt/taranom/nginx/ssl/poshaktaranom.com/ && \
  cp /etc/letsencrypt/live/poshaktaranom.ir/*.pem /opt/taranom/nginx/ssl/poshaktaranom.ir/ && \
  docker compose -f /opt/taranom/docker-compose.yml restart nginx") | crontab -
```

---

## صفحات موجود

| آدرس | توضیح |
|------|--------|
| `/` | صفحه اصلی عمده‌فروشی |
| `/products` | کاتالوگ محصولات |
| `/portal/login` | ورود مشتری |
| `/portal/register` | درخواست عضویت |
| `/portal/dashboard` | داشبورد مشتری |
| `/portal/dashboard/orders` | سفارش‌های مشتری |
| `/portal/dashboard/invoices` | فاکتورهای مشتری |
| `/admin` | داشبورد مدیر |
| `/admin/customers` | لیست مشتریان (CRM) |
| `/admin/orders` | مدیریت سفارش‌ها |
| `/admin/products` | مدیریت محصولات |

---

## API Endpoints

Base URL: `https://api.poshaktaranom.com/v1` (production) یا `http://localhost:4000/v1` (development)

| Method | Path | توضیح |
|--------|------|--------|
| GET | `/health` | بررسی سلامت سرویس |
| POST | `/auth/register` | ثبت‌نام مشتری |
| POST | `/auth/login` | ورود |
| GET | `/customers` | لیست مشتریان (ادمین) |
| POST | `/customers` | ثبت مشتری جدید |
| PATCH | `/customers/:id` | ویرایش مشتری |
| DELETE | `/customers/:id` | حذف مشتری |
| GET | `/products` | کاتالوگ محصولات |
| POST | `/products` | ثبت محصول (ادمین) |
| PATCH | `/products/:id` | ویرایش محصول |
| DELETE | `/products/:id` | حذف محصول |
| GET | `/orders` | لیست سفارش‌ها |
| POST | `/orders` | ثبت سفارش |
| PATCH | `/orders/:id/status` | تغییر وضعیت سفارش |
| GET | `/invoices` | فاکتورها |

مستندات کامل Swagger: `https://api.poshaktaranom.com/api/docs`

---

## ساختار پروژه

```
Site BtoB/
├── apps/
│   ├── web/              ← Next.js 15 (فرانت‌اند B2B + پنل مشتری + ادمین)
│   └── api/              ← NestJS 10 (بک‌اند REST API)
├── packages/
│   ├── shared-types/     ← انواع TypeScript مشترک
│   └── persian-utils/    ← ابزارهای فارسی (تاریخ جلالی، ریال، تلفن)
├── nginx/
│   ├── nginx.conf        ← تنظیمات Nginx (SSL، reverse proxy)
│   └── ssl/              ← گواهی‌های SSL (ایجاد توسط certbot)
├── docker-compose.yml    ← تعریف سرویس‌های Docker
├── deploy.sh             ← اسکریپت استقرار خودکار
├── .env.example          ← نمونه متغیرهای محیطی
└── SETUP.md              ← این فایل
```
