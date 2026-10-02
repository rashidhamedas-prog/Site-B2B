# گزارش: وضعیت «پیامک خوش‌آمد ارسال شد» + چک اتصال SMS

تاریخ: 2026-10-03  
تسک: TASK-20261003-006  
عمق: skill-top standard

## چک اتصال SMS (لایو)

| مورد | نتیجه |
|------|--------|
| زنجیره کد دکمه → `POST …/welcome-sms` → `salesPartnerWelcome` → `sendSms` → sms.ir | وصل |
| `sms.enabled` در DB | `true` |
| apiKey در DB | set |
| `events.salesPartnerWelcome` در DB | خالی → کد پیش‌فرض `?? true` → فعال |
| مارکر در کانتینر API | `salesPartnerWelcome` + `welcome-sms` |
| auditهای `credentials.welcome_sms_sent` | ۸ ردیف (ارسال قبلی ثبت شده) |

## تغییر UI/API

- `listApplications` فیلدهای `welcomeSmsSent` و `welcomeSmsLastSentAt` را از آخرین audit می‌گیرد
- کارت تأییدشده: برچسب سبز «پیامک خوش‌آمد ارسال شد · تاریخ» + دکمه «ارسال مجدد پیامک»
- برچسب audit فارسی برای `credentials.welcome_sms_sent`

## تأیید

- `apps/web` `tsc --noEmit`: OK
- isolation: assertهای `welcomeSmsSent` قبل از failure قدیمی focus-nav پاس شدند
