# گزارش سخت‌سازی تراکنش checkout

تاریخ: 2026-07-31

## هدف

بستن شکاف تراکنشی ثبت سفارش و جلوگیری از deploy ناخواسته در حین ادامهٔ hardening.

## تغییرات

- متدهای تغییر موجودی واریانت، موجودی کیف پول و شمارندهٔ مصرف تخفیف اکنون `EntityManager` اختیاری می‌پذیرند.
- ایجاد Order/OrderItem و تمام اثرهای موجودی و مالی checkout داخل یک transaction واحد اجرا می‌شود.
- مسیر جبران best-effort بعد از commit حذف شد؛ خطا اکنون transaction را rollback می‌کند و state نیمه‌کاره باقی نمی‌گذارد.
- فایل حافظهٔ tracked حاوی دادهٔ حساس از HEAD حذف و `.Codex/memory.json` بدون secret ایجاد شد.
- job استقرار GitHub Actions فقط با `workflow_dispatch` روی شاخهٔ اصلی و environment تولید اجرا می‌شود.

## API، DB و migration

- قرارداد API تغییر نکرد.
- schema و migration جدیدی لازم نبود.
- متغیر محیطی جدیدی اضافه نشد.

## بررسی‌های اجراشده

- `npm.cmd exec --workspace apps/api -- tsc --noEmit` — موفق
- تست مستقل منطق OTP با `ts-node` — موفق
- `npm.cmd run build --workspace apps/api` — موفق
- secret scan محدود روی HEAD — کلید خصوصی پیدا نشد؛ چند فایل قدیمی دارای الگوی credential همچنان برای ممیزی و پاک‌سازی نیازمند بررسی هستند.

## ریسک و کار باقی‌مانده

- credential افشاشده باید توسط مالک rotate و سپس با تأیید صریح از کل تاریخچهٔ Git پاک شود.
- تست concurrency واقعی با PostgreSQL و تست‌های integration هنوز باید پس از آماده‌سازی محیط تست افزوده شوند.
- محافظت approval برای GitHub Environment باید در تنظیمات repository فعال شود.
- هیچ commit، push، migration تولید یا deploy در این جلسه انجام نشد.
