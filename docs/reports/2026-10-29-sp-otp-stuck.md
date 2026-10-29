# گزارش: گیر کردن متقاضیان همکار بازاریاب در PENDING_OTP

تاریخ: ۱۴۰۵/۰۸/۰۷ (2026-10-29)  
شاخه: `ai/TASK-20261029-sp-otp-stuck`  
سرور: ایران `185.213.167.61` (فقط‌خواندنی قبل از تغییر)

## ۱) علت‌های تأییدشده

1. **ذخیره قبل از ارسال OTP** — `sales-partner.service.ts` درخواست را با `PENDING_OTP` ذخیره می‌کند، سپس `issueOtp` را صدا می‌زند؛ اگر ارسال در production با `delivery === 'failed'` به ۵۰۳ برسد، رکورد گیر می‌کند و audit `application.otp_requested` نوشته نمی‌شود.
2. **شواهد DB** — ۲۵ ردیف `PENDING_OTP`؛ از ۹ درخواست از ۲۰۲۶-۱۰-۲۷ به بعد، همگی `otp_audits = 0` (یعنی شکست قبل از audit).
3. **بدون لاگ تلاش ارسال** — شکست/timeout در کارت ادمین ثبت نمی‌شد؛ مسیر OTP از جدول `sms_message` پنل پیامک عبور نمی‌کند.
4. **TIMEOUT/NETWORK → pending** — `otpDispatchFromTransport` بدون ثبت، به کاربر «ارسال شد»گونه نشان می‌داد.

### تنظیمات SMS (بدون secret)

| مورد | وضعیت |
| --- | --- |
| `app_settings.sms.enabled` | true |
| `otpTemplateId` | رشته غیرخالی با **طول ۱** (عملاً نامعتبر برای verify؛ اغلب placeholder مثل `0`) |
| `lineNumber` | YES |
| `apiKey` | YES |
| `egressBaseUrl` | NO (روی ایران معمولاً لازم نیست) |

### تکمیل علت

5. **`otpTemplateId` بی‌اعتبار (طول ۱):** مسیر قدیمی با `!secrets.otpTemplateId` این مقدار را «موجود» می‌بیند و `/send/verify` با template بی‌اعتبار می‌زند → شکست PROVIDER → ۵۰۳. کد جدید با `Number(...) > 0` آن را به fallback خط خدماتی می‌برد تا قالب واقعی ست شود.
6. لاگ Docker برای ۶–۸ آبان به‌خاطر ری‌استارت API (~۲۰:۲۰ UTC ۲۹ اکتبر) تقریباً خالی است.

## ۲) تعداد گیرکرده

- **۲۵** درخواست `PENDING_OTP` در production (۵ مورد مربوط به امروز UTC 2026-10-29).
- شماره‌ها در گزارش ماسک شده‌اند (مثلاً `0912***7255`).

## ۳) تغییرات کد

- OTP همیشه verify/`chooseOtpSendPath`؛ fallback فقط خط خدماتی + هشدار.
- `lastSmsAttempt` روی application + audit `application.otp_dispatch` / `credentials_sms`.
- ادمین: dry-run، ارسال مجدد OTP، تأیید دستی + رمز (تکی/گروهی)، UI.
- `mustChangePassword` روی پروفایل همکار.
- Migration: `20261029-003-sp-otp-delivery-attempt.ts`.

## ۴) تست

- `otp-send-path.spec.ts` ok
- `sales-partner-sms-attempt.spec.ts` ok
- `sales-partner-otp-dispatch.spec.ts` ok
- `apps/api` + `apps/web` `tsc --noEmit` سبز (با junction به node_modules اصلی)

## ۵) دیپلوی

- **منتظر deploy-approval حامد** — فایل `/opt/taranom/deploy-approval.json` توسط ایجنت نوشته نمی‌شود.
- Merge به master فقط با GO نوشتاری حامد.

## ۶) کار فقط حامد

1. GO برای merge + نوشتن `deploy-approval.json` با SHA نهایی.
2. پس از دیپلوی: در `/admin/sales-partners` تب درخواست‌ها → dry-run/دکمه‌های جدید؛ ارسال واقعی برای افراد گیرکرده.
3. در تنظیمات SMS، **`otpTemplateId` واقعی قالب verify** را بگذارید (الان طول ۱ / placeholder است).
4. اگر هنوز OTP شکست خورد: اعتبار sms.ir و تأیید قالب در پنل sms.ir را چک کنید.
