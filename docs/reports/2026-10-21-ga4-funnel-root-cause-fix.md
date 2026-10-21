# گزارش — فیکس ریشه‌ای قیف GA4 (تکی + عمده) — ۲۱ اکتبر ۲۰۲۶

Task: `TASK-20261021-001` · ریسک: high (مسیر پرداخت + migration) · وضعیت: آماده review، هنوز commit/deploy نشده.

## علت‌های ریشه‌ای (با شواهد Windsor/GA4)

1. **begin_checkout > add_to_cart (۱۴ در برابر ۴، ۲۰ اکتبر):** `begin_checkout` روی mount صفحهٔ `/checkout` شلیک می‌شد و گارد آن یک `useRef` بود که با هر رفرش/remount/برگشت از درگاه صفر می‌شد. سبدِ persist‌شده از روزهای قبل هم بدون add_to_cart تازه به checkout می‌رسید.
2. **add_shipping_info / add_payment_info تورمی (۱۴ و ۱۷):** از `useEffect` روی تغییر quote/انتخاب/مبلغ شلیک می‌شد؛ dedupe فقط در حافظه بود. هر بازدید از checkout = رویداد جدید.
3. **purchase = 0 (۷ روز):** `/payment/*` بیرون از layout تکی است؛ `GoogleAnalyticsProvider` آنجا mount نمی‌شد → نه config نه page_view. purchase فقط کلاینتی و وابسته به localStorage بود.
4. **Landing page خالی (not set):** همان صفحهٔ برگشت از درگاه بدون page_view؛ به‌علاوه تأخیر fetch تنظیمات قبل از اولین page_view.
5. **web.mydigipay.com به‌عنوان referral (۹ session):** Unwanted referrals در GA4 Admin ثبت نشده (کار دستی).
6. **ترب با medium مختلط (`TorobPay_pdp` / `ads`):** از پنل ترب است؛ سایت ورودی UTM را بازنویسی نمی‌کند (کار دستی).
7. **عمده فقط page_view:** Measurement ID عمده fallback نداشت؛ هیچ رویداد view_item/lead وجود نداشت.

## تغییرات

- **قیف چک‌اوت (تکی و عمده):** begin/shipping/payment فقط در `submit()` بعد از validation؛ dedupe = حافظه + `sessionStorage` بر اساس fingerprint سبد.
- **purchase سمت سرور (Measurement Protocol):** بعد از verify موفق در `PaymentService`، `Ga4PurchaseService` با جدول `analytics_event_log` و `UNIQUE(eventName, transactionId)` دقیقاً یک‌بار می‌فرستد (claim اتمیک، ۲ تلاش با timeout ۴ ثانیه، لاگ وضعیت). شکست یا نبود client_id → `CLIENT_FALLBACK` یک‌طرفه و مرورگر purchase را (با dedupe خودش) می‌فرستد؛ هیچ مسیری هر دو را نمی‌فرستد. پشت flag `GA4_SERVER_PURCHASE_ENABLED` (پیش‌فرض خاموش).
- **`/payment/layout`:** GA provider بر اساس host → page_view و config روی صفحهٔ برگشت.
- **سفارش بدون پرداخت (COD/کارت‌به‌کارت):** دیگر purchase نیست.
- **عمده:** `view_item` (یک‌بار برای هر محصول)، `select_item` روی کارت، `wholesale_cta_click`، `phone/whatsapp/telegram_click` از یک listener سراسری (منبع واحد)، `wholesale_order_request` بعد از ساخت موفق سفارش. هیچ purchase/add_to_cart ساختگی.
- **purchase عمده در مرورگر:** گارد `trackPurchase` فقط host تکی را قبول می‌کرد؛ حالا host-aware است (fallback مرورگر روی `.com` هم کار می‌کند). `generate_lead` بعد از ثبت‌نام موفق همکار در پورتال.
- **همکار فروش:** `affiliate_order_created` / `affiliate_payment_link_sent` بعد از موفقیت API و با dedupe روی id؛ purchase نیستند.
- **لینک‌های تکی → عمده:** UTM ثابت `poshaktaranom.ir / referral / retail_to_wholesale`.
- **PII:** همهٔ پارامترها از `sanitizeEventParams` (کلید و مقدار) رد می‌شوند؛ body سرور هم فیلتر PII دارد و تست می‌شود.

## جدول قبل / بعد

| رویداد | قبل | بعد |
|---|---|---|
| begin_checkout | هر mount/رفرش/برگشت درگاه | یک‌بار در هر session برای هر سبد، روی «ثبت سفارش» |
| add_shipping_info | هر تغییر state | یک‌بار برای هر (سبد، روش ارسال) روی submit |
| add_payment_info | هر تغییر state | یک‌بار برای هر (سبد، روش پرداخت) روی submit |
| purchase | ۰ (صفحه بی‌GA) | فقط بعد از verify؛ سرور (MP) یا fallback مرورگر، دقیقاً یک‌بار |
| page_view `/payment/callback` | ندارد | دارد |
| عمده view_item / select_item | ندارد | دارد |
| عمده lead events | ندارد | phone/whatsapp/telegram_click، wholesale_cta_click، wholesale_order_request |
| affiliate_payment_link_sent | با هر ارسال مجدد | یک‌بار برای هر پیش‌نویس |

## تست‌ها

- `tsc --noEmit` وب: سبز. `next build` وب: سبز (First Load shared 103 kB).
- `tsc` API: فقط خطای از‌قبل‌موجود در `order-money-guard.spec.ts` (فایلی که دست نخورده).
- `retail-analytics.spec.ts` (+ تست‌های جدید dedupe، کوکی GA، lead و PII)، `checkout-payment-ui.spec.ts`: سبز.
- API: `ga4-mp.spec.ts`، `20261021-001-analytics-event-log.spec.ts`، و specهای payment hardening / concurrency / installment / zarinpal / order-payment-lifecycle / db-sync: سبز.
- dependency جدید: ندارد. lockfile: دست نخورده.

## Migration

`20261021-001-analytics-event-log` فقط یک جدول جدید می‌سازد (`CREATE TABLE IF NOT EXISTS` + unique + دو index). به جدول‌های موجود دست نمی‌زند. down = `DROP TABLE IF EXISTS "analytics_event_log"`.
در production با `migrationsRun` هنگام بالا آمدن api اجرا می‌شود ← **قبل از دیپلوی بکاپ `pg_dump` بگیرید.**

`20261021-002-analytics-event-log-ga-ids` دو ستون nullable (`gaClientId`، `gaSessionId`) اضافه می‌کند تا job بتواند purchaseهای ناموفق سمت سرور را دوباره بفرستد. شناسهٔ مستعار `_ga` است، نه داده شخصی.

## Rollback

1. فوری: `GA4_SERVER_PURCHASE_ENABLED=false` و ری‌استارت api (purchase به مرورگر برمی‌گردد).
2. کد: `git revert` روی commit. **وب و API را با هم برگردانید:** وب حالا `gaClientId`/`gaSessionId` را به `/payments/verify` می‌فرستد و DTO قدیمی (با `forbidNonWhitelisted`) آن را با 400 رد می‌کند.
3. دیتابیس (اختیاری): migration down؛ جدول فقط لاگ آنالیتیکس است.

## بازبینی مستقل و اصلاحات (همان روز)

بازبینی کد/امنیت: **CHANGES REQUESTED** (فلگ خاموش بود، پس production آسیبی ندید). اصلاحات:

- **مالکیت purchase یک‌بار و اتمیک تعیین می‌شود.** با client id: سرور ردیف را `PENDING → SENDING` claim می‌کند و تنها فرستنده می‌ماند؛ شکست → `FAILED` و cron هر ۵ دقیقه (حداکثر ۵ تلاش، تا ۷۲ ساعت) دوباره می‌فرستد. بدون client id: `PENDING → CLIENT_FALLBACK` و سرور دیگر هرگز برای آن تراکنش نمی‌فرستد. claim ناموفق → وضعیت تازه از DB خوانده می‌شود (نه مقدار کهنه). این دوبار شمردن و صفر شمردن در verifyهای هم‌زمان را می‌بندد.
- **verify دیگر منتظر Google نمی‌ماند:** یک تلاش inline با سقف ۱.۵ ثانیه (قبلاً ۲×۴ ثانیه)؛ body پاسخ cancel می‌شود.
- **بعد از 2xx، خطای ثبت `SENT` دیگر purchase را به مرورگر نمی‌دهد.**
- مقایسهٔ stale با `now() - interval` در SQL (بی‌وابستگی به timezone Node).
- نام index‌های entity با migration یکی شد.
- `/checkout` عمده حالا GA را خودش mount می‌کند (رویدادهای checkout بعد از hard load گم نمی‌شوند).
- `page_location` پاک‌شده با `gtag('set')` هم ست می‌شود تا رویدادهای بعدی صفحهٔ برگشت (مثل purchase) توکن درگاه (`Authority`، `paymentId`) را به Google نبرند.
- `view_item` ساختگی وبلاگ حذف شد (مقاله را محصول حساب می‌کرد)؛ فقط `blog_article_view` می‌ماند.

تصمیم محصولی (بدون تغییر): سفارش COD تکی تا پرداخت نشود `purchase` نیست.

## SEO

URL، canonical، robots، sitemap، metadata، schema، H1، SSR و noindex تغییر نکرده‌اند. `/payment/*` در `robots.txt` disallow است؛ layout آن حالا برای تشخیص host از `headers()` استفاده می‌کند و per-request رندر می‌شود — روی صفحهٔ تراکنشیِ غیرقابل‌ایندکس، بی‌اثر بر SEO. تنها تغییر قابل‌دیدن، query string لینک‌های خروجی به دامنهٔ عمده است؛ canonical خود سایت عمده آن‌ها را یکی می‌کند.

## ریسک‌های باقی‌مانده

- تا Unwanted referrals و پنل ترب دستی اصلاح نشوند، mydigipay و medium مختلط ترب در گزارش‌ها می‌مانند.
- اگر `_ga` کوکی مسدود باشد (adblock)، MP مقدور نیست و fallback مرورگر هم احتمالاً بلاک است — purchase از دست می‌رود (نه دوبار).
- داده‌های گذشته اصلاح نمی‌شوند؛ مقایسهٔ قبل/بعد را از تاریخ دیپلوی ببینید.
- فرم تماس واقعی در عمده وجود ندارد (صفحهٔ CMS)؛ `contact_form_*` فعلاً شلیک نمی‌شود.

راهنمای کارهای دستی: `docs/analytics/GA4-FUNNEL-FIX-MANUAL-STEPS.md`.
