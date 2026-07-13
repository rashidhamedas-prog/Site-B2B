# گزارش — بازیابی سایت پس از حذف deploy

| فیلد | مقدار |
|------|--------|
| **تاریخ** | ۲۰۲۶-۰۷-۱۱ |
| **علت قطعی** | حذف کامل `/opt/taranom` از سرور — فقط پروژه peyvand باقی مانده بود |
| **نتیجه** | سایت بالا آمد — دیتابیس خالی |

## علائم
- `https://poshaktaranom.com` پاسخ نمی‌داد
- پورت‌های ۸۰ و ۴۴۳ باز نبودند
- `docker ps` فقط `peyvand-*` نشان می‌داد

## اقدامات انجام‌شده
1. `git clone` از `https://github.com/rashidhamedas-prog/Site-BtoB` به `/opt/taranom`
2. ساخت `.env` از تنظیمات `TARANOM-SERVER-INFO.txt`
3. کپی SSL از `/etc/letsencrypt/live/poshaktaranom.com/`
4. `docker compose build api web && docker compose up -d`
5. bootstrap schema (synchronize موقت) + `seed.js` برای ادمین

## وضعیت فعلی
| سرویس | وضعیت |
|--------|--------|
| taranom_nginx | Up — 80/443 |
| taranom_web | Up — 3000 |
| taranom_api | Up — 4000 |
| taranom_postgres | Up (volume جدید) |
| taranom_minio | Up (volume جدید) |

## از دست رفته
- محصولات، سفارش‌ها، مشتریان قبلی
- عکس‌های MinIO قبلی

## پیشگیری
- backup روزانه: `docker exec taranom_postgres pg_dump ...`
- `scripts/redeploy-server.sh` برای بازیابی سریع
- `DB_SYNC=true` در `.env` فقط برای bootstrap اولیه (نگه ندارید)

## اسکریپت‌ها
- `scripts/redeploy-server.sh` — deploy از git
- `scripts/bootstrap-db-server.sh` — ایجاد جداول + seed
