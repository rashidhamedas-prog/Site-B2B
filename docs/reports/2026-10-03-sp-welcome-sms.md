# گزارش: پیامک خوش‌آمد همکار بازاریاب

تاریخ: 2026-10-03  
تسک: TASK-20261003-005  
عمق: skill-top full + h2h

## هدف

در `/admin/sales-partners` برای کارت‌های تأییدشده، دکمه‌ای زیر بج «تأییدشده» که با تأیید ادمین، پیامک خوش‌آمد حرفه‌ای با نام کاربری (موبایل)، رمز موقت، و لینک ورود پنل بفرستد.

## پیاده‌سازی

- UI: دکمه «ارسال پیامک خوش‌آمد» فقط وقتی `status === 'APPROVED'`
- API: `POST /v1/admin/sales-partners/applications/:id/welcome-sms` (ADMIN + AdminOnly)
- تولید رمز CSPRNG، bcrypt، ارسال از طریق `NotificationService.salesPartnerWelcome`
- قالب پیش‌فرض `salesPartnerWelcome` + رویداد قابل‌خاموش در تنظیمات SMS
- لینک ورود: `{NEXT_PUBLIC_RETAIL_URL}/sales-partners/login`
- پاسخ API هرگز رمز plaintext برنمی‌گرداند؛ لاگ SMS با `redactBody`
- قفل pessimistic روی کاربر؛ بازگردانی hash در صورت شکست SMS در production
- کول‌داون ۱۵ دقیقه پس از ارسال موفق (audit)

## متن پیامک (H2H / ترنم)

کوتاه، حرفه‌ای، بدون اغراق فروش؛ شامل خوش‌آمد، نام کاربری، رمز، لینک پنل، یادآوری عدم اشتراک‌گذاری رمز.

## تأیید

- `sales-partner-welcome-sms.spec.ts`: OK
- `sales-partner-isolation.spec.ts`: assertهای welcome-sms OK (شکست قبلی unrelated روی focus partner nav)
- `apps/web` `tsc --noEmit`: clean
- Security review: 0 critical/high؛ mediumهای rollback/race با قفل + restore پوشش داده شد

## ریسک باقیمانده

- رمز در کانال SMS plaintext است (خواست محصول). ترجیح بلندمدت: دعوت OTP بدون رمز ثابت.
- کلیک واقعی ادمین روی production پس از deploy نیاز به smoke دارد.
