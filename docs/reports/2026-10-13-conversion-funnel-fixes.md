# اصلاح قیف تبدیل تکی + عمده — ۱۴۰۵/۰۷/۲۱

**تسک:** TASK-20261013-003  
**شاخه:** `ai/TASK-20261013-003-conversion-funnel`

## تصمیم‌های قفل‌شده

1. قیمت عمده برای مهمان **علنی** (هم‌راستا با PDP).
2. COD تکی فقط اگر ادمین روشن کرده باشد — بدون force-enable.
3. TorobPay در UI مخفی تا قرارداد زنده شود.
4. سیاست PENDING عمده بدون تغییر.

## تغییرات

| حوزه | چه شد |
|------|--------|
| تکی checkout | قبل از ریدایرکت درگاه `clear()` نمی‌شود؛ فقط COD/موفقیت غیرریدایرکت clear می‌کند |
| payment/callback | روی `res.ok` سبد تکی + عمده پاک می‌شود؛ fail/cancel دکمه بازگشت به سبد |
| تکی auth | `clearToken()` فقط وقتی نشست واقعاً منقضی است |
| پرداخت | `RETAIL_TOROBPAY_UI_ENABLED = false` |
| کارت عمده | قیمت بدون لاگین؛ بدون `getToken` فقط برای قیمت |
| analytics عمده | `shouldSendRetailAnalytics({ channel: 'WHOLESALE' })` روی `.com`؛ `add_to_cart` / `begin_checkout` |

## تست

- `npx tsx apps/web/src/lib/checkout-payment-ui.spec.ts` → ok
- `npx tsx apps/web/src/lib/retail-analytics.spec.ts` → ok
- `apps/web` `tsc --noEmit` → ۰

## پذیرش

- [x] سبد تکی تا verify موفق می‌ماند
- [x] TorobPay در UI نیست
- [x] COD فقط admin-gated
- [x] قیمت عمده روی کارت بدون ورود
- [x] GA4 ecommerce عمده قابل ارسال
- [x] PENDING عمده دست‌نخورده
