# DigiPay admin connection test

تاریخ: 2026-09-03  
تسک: TASK-20260903-003

## هدف

بعد از رد شدن OAuth زنده با HTTP 401، ادمین باید بدون حدس بتواند بفهمد **کلاینت** رد شده یا **نام کاربری/رمز UPG**، و وضعیت «پیکربندی‌شده» فقط با هر چهار فیلد سبز شود.

## معماری

| لایه | مسئولیت |
|------|---------|
| `DigiPayAdapter.probeConnection` | OAuth فقط؛ بدون تیکت خرید؛ بدون برگرداندن توکن/راز |
| `classifyDigipayOauthFailure` | `invalid_client` (Spring 401 / Basic) در برابر `invalid_grant` |
| `POST /payments/digipay/connection-test` | ADMIN + AdminOnly؛ بدنهٔ اختیاری برای تست فرم ذخیره‌نشده |
| `settings.payment().digipayConfigured` | هر چهار فیلد |
| Admin settings | برچسب UPG + دکمه تست |

## جریان

1. ادمین مقادیر را وارد می‌کند (حتی قبل از ذخیره).
2. دکمه تست → API با override یا تنظیمات ذخیره‌شده OAuth می‌زند.
3. پاسخ: `ok`, `stage`, `failureClass`, `message`, `sandbox`, `meta` (فقط طول‌ها).

روی production عمداً تیکت type=11 ساخته نمی‌شود تا اثر جانبی مالی/تیکت یتیم نباشد.

## اعتبارسنجی

- `digipay.adapter.spec.ts` (شامل classify + probe)
- `apps/api` و `apps/web` `tsc --noEmit`

## غیرهدف

- اصلاح اعتبارنامهٔ ردشده توسط دیجی‌پی (کار پشتیبانی پذیرنده است)
- پرداخت واقعی تستی
