# DigiPay UPG — فروشگاه تکی

تاریخ: 2026-08-24  
تسک: TASK-20260824-003

## هدف

وصل کردن درگاه یکپارچه دیجی‌پی (UPG، type=11) به چک‌اوت فروشگاه تکی. عمده روی زرین‌پال می‌ماند.

## جریان

1. OAuth `POST /oauth/token` با Basic(client_id:client_secret) و form `username/password/grant_type=password`
2. تیکت `POST /tickets/business?type=11` با مبلغ ریال، موبایل، `providerId=payment.id`، callback
3. هدایت مشتری به `redirectUrl`
4. بازگشت GET یا POST به `/payment/digipay/callback` → ریدایرکت ۳۰۳ به `/payment/callback`
5. تایید `POST /purchases/verify?type=11` با `trackingCode` + `providerId`؛ مبلغ باید با سفارش یکی باشد

## تنظیم سرور (بدون commit)

```
DIGIPAY_CLIENT_ID=
DIGIPAY_CLIENT_SECRET=
DIGIPAY_USERNAME=
DIGIPAY_PASSWORD=
DIGIPAY_SANDBOX=false
```

اگر username/password خالی باشد، همان client_id/secret برای grant password فرستاده می‌شود. پنل دیجی‌پی معمولاً هر چهار مقدار را جدا می‌دهد.

## ادمین

`/admin/settings` → درگاه پرداخت → انتخاب «دیجی‌پی» یا «زرین‌پال» برای تکی. رازها در فرم ذخیره نمی‌شوند.

## مهاجرت

`20260824-001-digipay-upg-retail.ts` ردیف `DIGIPAY` را از BNPL غیرفعال به PSP تکی APPROVED تبدیل می‌کند.

## غیرهدف

- عمده
- قرارداد BNPL داخلی (اسنپ‌پی/تارا)
- تست پرداخت واقعی با پول
