# اجرای عملیات نهایی hardening و انتشار

حالت اجرا: Interactive (تأیید کلی مالک در 2026-08-01 دریافت شد)

## دامنه و معیار پذیرش

- [x] فاز 1 — preflight محلی
  - هدف: اطمینان از وجود تغییرهای hardening روی شاخه اصلی و شناسایی تغییرهای محلی.
  - هدف فایل: Git refs، workflow و اسناد عملیات.
  - راستی‌آزمایی: `git status`، `git log --all`، مقایسه با `origin/master`.
  - پذیرش: commit سخت‌سازی در ancestry شاخه اصلی و worktree بدون تغییر ناشناخته برای انتشار.
- [x] فاز 2 — backup و preflight تولید
  - هدف: بررسی دسترسی امن و گرفتن backup قبل از تغییر production.
  - هدف: VPS `/opt/taranom` و داده‌های PostgreSQL/MinIO.
  - راستی‌آزمایی: SSH key-only، وضعیت سرویس‌ها، وجود و اندازه backup بدون نمایش secret.
  - پذیرش: دسترسی key-only و backup قابل شناسایی قبل از deploy/rotation.
- [x] فاز 3 — انتشار و health check
  - هدف: deploy کنترل‌شده commit فعلی `origin/master`.
  - راستی‌آزمایی: API health، پاسخ وب عمده و تک، لاگ خطای سرویس.
  - پذیرش: سرویس‌ها سالم و نسخه اجراشده برابر commit منتشرشده.
- [-] فاز 4 — rotate و پاک‌سازی تاریخچه
  - هدف: revoke/rotate credentialهای افشاشده و حذف فایل/مقادیر حساس از تمام refs.
  - راستی‌آزمایی: credential قبلی نامعتبر، secret scan روی HEAD/history، force-sync refs.
  - پذیرش: هیچ credential واقعی در refs قابل‌دسترسی و دسترسی production فقط با credential جدید.
- [ ] فاز 5 — تأیید نهایی و مستندسازی
  - هدف: اجرای تست‌های نهایی و ثبت نتیجه.
  - راستی‌آزمایی: typecheck/test/build/health/secret scan.
  - پذیرش: شواهد ثبت‌شده و follow-upهای صریح.

## Progress

- 2026-08-01: فاز 1 کامل شد؛ commit `4021b59` در ancestry شاخه اصلی و `origin/master` است. شاخه اصلی با remote همگام و worktree پاک بود.
- 2026-08-01: فاز 2 شروع شد؛ دسترسی، backup و targetهای production در حال بررسی است.
- 2026-08-01: backup محدوددسترسی PostgreSQL، MinIO، env و imageهای rollback ساخته و بررسی شد؛ timer استقرار متوقف ماند.
- 2026-08-01: production به commit `e14dc4b` رسید؛ API و هر دو دامنه سالم و commit hardening در ancestry تأیید شد.
- 2026-08-01: SSH به key-only تغییر کرد و password حساب lock شد. PostgreSQL، Redis، MinIO، Meilisearch و JWT بدون افشای مقدار rotate شدند؛ health check مستقل موفق بود.
- 2026-08-01: mirror تمام ۲۸ branch بازنویسی شد؛ تاریخچه دو مسیر حساس صفر و Gitleaks 8.30.1 روی ۱۰۷ commit با صفر finding تمام شد.
- 2026-08-01: force-push همه ۲۸ branch توسط کنترل ایمنی متوقف شد تا دامنه دقیق overwrite و الزام fresh-clone یک بار دیگر به‌صورت صریح توسط مالک تأیید شود.

## Surprises & Discoveries

- پس از جلسه قبل، تغییرهای Hero روی master ادغام و push شده‌اند؛ hardening checkout نیز ancestor همان master است.
- `git-filter-repo` در محیط محلی نصب نیست.
- GitHub CLI به config کاربر دسترسی ندارد و برای تنظیمات repository فعلاً قابل اتکا نیست.
- سرور یک `nginx/nginx.conf` سفارشی داشت؛ پیش از reset backup شد و پس از deploy بازگردانده شد.
- توکن‌های سرویس‌های بیرونی مانند SMS/payment/CRM بدون دسترسی پنل ارائه‌دهنده قابل rotate خودکار نیستند.

## Decision Log

- عملیات با SSH key-only شروع می‌شود؛ هیچ credential قدیمی از history بازیابی یا در command/log چاپ نمی‌شود.
- قبل از هر deploy/rotate/history rewrite باید backup ساخته و target دقیق تأیید شود.
- پاک‌سازی history فقط پس از ساخت mirror backup محلی و اثبات فهرست مسیرهای حساس انجام می‌شود.
- تا پایان force-push و force-sync clone سرور، timer استقرار خاموش باقی می‌ماند.

## Outcomes & Retrospective

در پایان اجرا تکمیل می‌شود.
