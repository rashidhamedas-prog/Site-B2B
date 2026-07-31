# اجرای عملیات نهایی hardening و انتشار

حالت اجرا: Interactive — تأیید صریح force-push تمام ۲۸ branch در 2026-08-01 دریافت شد.

## فازها

- [x] preflight، backup و توقف timer
- [x] deploy کنترل‌شده و health check
- [x] rotate SSH و credentialهای داخلی
- [x] بازنویسی و اسکن تاریخچه Git
- [x] force-push تمام ۲۸ branch و force-sync clone production
- [-] ثبت یادداشت Cursor، فعال‌سازی timer و تأیید نهایی

## Progress

- backup DB/MinIO/env/image ساخته و بررسی شد.
- production منتشر و هر دو دامنه سالم شدند.
- SSH key-only و credentialهای داخلی rotate شدند.
- دو مسیر حساس از ۱۰۷ commit و ۲۸ branch حذف شدند.
- Gitleaks 8.30.1: صفر finding.
- master بازنویسی‌شده با SHA `0791278` force-push و clone production sync شد.

## Surprises & Discoveries

- nginx production تنظیم محلی داشت؛ قبل از reset ذخیره و پس از آن بازگردانده شد.
- GitHub credential نوشتن روی VPS موجود نبود؛ force-push با session معتبر GitHub محلی انجام شد.
- tokenهای بیرونی بدون پنل ارائه‌دهنده قابل rotate خودکار نیستند.

## Decision Log

- timer در کل عملیات خاموش ماند.
- force-push با `--all` و `--tags` انجام شد، نه `--mirror`، تا refهای مدیریتی GitHub حذف نشوند.
- cloneهای قدیمی نامعتبر و fresh-clone برای Cursor اجباری اعلام شد.

## Outcomes & Retrospective

عملیات اصلی کامل شد. فقط commit مستندات نهایی، فعال‌سازی timer و health check پایانی باقی مانده است.
