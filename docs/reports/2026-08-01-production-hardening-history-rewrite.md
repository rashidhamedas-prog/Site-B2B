# گزارش نهایی hardening تولید و بازنویسی تاریخچه

تاریخ: 2026-08-01

## نتیجه

- backup محدوددسترسی PostgreSQL، MinIO، env و imageهای rollback پیش از عملیات ساخته و بررسی شد.
- timer استقرار حین عملیات متوقف و تنظیم سفارشی nginx حفظ شد.
- نسخه production منتشر و API، فروشگاه عمده و فروشگاه تک health-check شدند.
- SSH به key-only منتقل و password قدیمی حساب lock شد.
- PostgreSQL، Redis، MinIO، Meilisearch و JWT بدون ثبت یا نمایش مقدار rotate شدند.
- دو مسیر قطعی حساس با `git-filter-repo` از تاریخچه تمام ۲۸ branch حذف شدند.
- bundle پیش از rewrite ساخته و با `git bundle verify` بررسی شد.
- Gitleaks 8.30.1 پس از checksum verification، ۱۰۷ commit را با صفر finding اسکن کرد.
- تمام branchها force-push و clone production به history جدید force-sync شد.

## راستی‌آزمایی

- PostgreSQL dump با `pg_restore -l` قابل خواندن بود.
- snapshot MinIO ساخته و سرویس پس از آن healthy شد.
- API `/v1/health` موفق بود.
- `https://poshaktaranom.com` و `https://www.poshaktaranom.ir` موفق بودند.
- تاریخچه دو مسیر حذف‌شده صفر commit و اسکن Gitleaks صفر finding داشت.

## ریسک و follow-up

- تمام cloneهای قدیمی باید کنار گذاشته و fresh-clone شوند.
- tokenهای بیرونی SMS/payment/CRM باید در پنل ارائه‌دهندگان توسط مالک rotate شوند.
- backup حاوی تاریخچه قدیمی secret-bearing است؛ باید محدوددسترسی بماند و پس از پایان دوره rollback به‌صورت امن حذف شود.
- GitHub Secret Scanning، Push Protection و حفاظت environment تولید باید در تنظیمات repository فعال و بررسی شوند.
