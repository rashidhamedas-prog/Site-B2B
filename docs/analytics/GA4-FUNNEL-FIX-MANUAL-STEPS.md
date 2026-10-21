# GA4 — کارهای دستی بعد از فیکس قیف (۲۱ اکتبر ۲۰۲۶)

این‌ها کارهایی هستند که فقط از پنل GA4 / GTM / ترب انجام می‌شوند و کد نمی‌تواند جایشان را بگیرد.
شناسه‌ها از Windsor/GA4 Admin تأیید شده‌اند؛ چیزی حدسی نیست.

| سایت | Property | Stream | Measurement ID | GTM |
|---|---|---|---|---|
| تکی | 547378194 | Retail — www.poshaktaranom.ir | `G-F2V7VSJMLE` | `GTM-NKBCGQJV` |
| عمده | 547352333 | Wholesale - poshaktaranom.com | `G-YVT5DXZF5Z` | `GTM-M3LQFGZV` |

## ۱. Unwanted referrals (هر دو property)

Admin → Data streams → (stream) → Configure tag settings → Show more → **List unwanted referrals** → شرط «Referral domain contains»:

- `mydigipay.com` (شامل `web.mydigipay.com`، `www.`، `api.`)
- `mydigipay.info` (محیط UAT)
- `zarinpal.com`
- `torobpay.com`
- `shaparak.ir` (صفحهٔ بانک‌ها)

`poshaktaranom.ir` و `poshaktaranom.com` را اضافه **نکنید** — دو سایت مستقل‌اند و ارجاع بینشان باید دیده شود.
کد هم روی `/payment/*` فقط وقتی `document.referrer` یکی از درگاه‌هاست `ignore_referrer` می‌گذارد؛ این دو مکمل هم‌اند.

## ۲. Cross-domain

لینک نکنید. `.ir` و `.com` دو property جدا هستند. ترافیک تکی → عمده با UTM ثابت علامت می‌خورد:
`utm_source=poshaktaranom.ir&utm_medium=referral&utm_campaign=retail_to_wholesale&utm_content=<جای لینک>`
(`footer`, `home_cta`, `boutique_home_cta`).

## ۳. پنل ترب (Torob)

الان همان ترافیک با دو medium می‌آید: `Torob / TorobPay_pdp` و `Torob / ads`. این از تنظیمات پنل ترب است نه سایت.
در پنل فروشندهٔ ترب، اگر فیلد «پارامتر ردیابی / UTM» دارد، دقیقاً این را بگذارید (حروف کوچک):

```
utm_source=torob&utm_medium=cpc&utm_campaign=<category-or-campaign>
```

اگر ترب اجازهٔ تغییر نمی‌دهد: در GA4 → Admin → Data display → **Channel groups** یک کانال سفارشی «Torob» با شرط `Session source matches regex (?i)^torob` بسازید تا گزارش‌ها یکی شوند. داده‌های قبلی را دستی تغییر ندهید.

## ۴. Measurement Protocol (purchase سمت سرور)

1. Admin → Data streams → Retail → **Measurement Protocol API secrets** → Create → نام `api-purchase`.
2. همین کار برای stream عمده.
3. روی VPS در `/opt/taranom/.env` (نه در گیت، نه با `NEXT_PUBLIC_`):
   ```
   GA4_MP_RETAIL_API_SECRET=<secret>
   GA4_MP_WHOLESALE_API_SECRET=<secret>
   GA4_SERVER_PURCHASE_ENABLED=true
   ```
4. فقط کانتینر api را ری‌استارت کنید. تا وقتی flag خاموش است، purchase مثل قبل از مرورگر (بعد از verify) فرستاده می‌شود.
5. وارسی: یک پرداخت تست → جدول `analytics_event_log` یک ردیف `purchase` با `status='SENT'` → در GA4 Realtime/DebugView رویداد purchase با همان `transaction_id` (شمارهٔ سفارش).

## ۵. Key events

- تکی: `purchase` (فقط همین؛ `begin_checkout` را key event نکنید).
- عمده: `purchase`، `generate_lead` (ثبت‌نام همکار)، `wholesale_order_request`، `phone_click`، `whatsapp_click`، `telegram_click`.
  `wholesale_cta_click` را key event نکنید (باز کردن منو است، نه تماس).

## ۶. Internal traffic و staging

1. Admin → Data streams → (stream) → Configure tag settings → **Define internal traffic** → قانون با IP دفتر/تیم، `traffic_type=internal`.
2. Admin → Data filters → فیلتر Internal Traffic را اول در حالت **Testing** بگذارید؛ در Explore با بُعد «Test data filter name» چک کنید؛ بعد از یک هفته **Active**.
3. staging/localhost از قبل در کد بلاک است (`isNonProductionAnalyticsHost`)؛ برای staging هیچ Measurement ID یا secret تولید نگذارید.

## ۷. Enhanced measurement و GTM

- «Page changes based on browser history events» در هر دو stream **خاموش** بماند (page_view را اپ می‌فرستد).
- در GTM هیچ تگ GA4 Event برای `page_view`، `purchase`، `begin_checkout`، `add_to_cart` یا رویدادهای lead نسازید؛ اپ مستقیم با `gtag` می‌فرستد و تگ اضافه یعنی دوبار شمردن.
- Google tag در GTM: `send_page_view=false`.

## ۸. وارسی بعد از دیپلوی (DebugView)

| مسیر | انتظار |
|---|---|
| باز کردن `/checkout` و رفرش | هیچ `begin_checkout` |
| زدن «ثبت سفارش» | دقیقاً یک `begin_checkout` + یک `add_shipping_info` + یک `add_payment_info` |
| برگشت از DigiPay | `page_view` روی `/payment/callback`، source همان قبلی (نه mydigipay) |
| verify موفق | یک `purchase`؛ رفرش صفحهٔ callback → purchase دوم نه |
| عمده: کلیک تلفن در دکمهٔ شناور | یک `phone_click` با `cta_location=floating_contact` |
