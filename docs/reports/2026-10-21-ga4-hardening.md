# 2026-10-21 — سخت‌سازی GA4 (TASK-20261021-002)

ادامهٔ `2026-10-21-ga4-funnel-root-cause-fix.md`. بدون پکیج جدید، بدون تغییر lockfile، canonical/robots/sitemap/metadata/URL دست نخورده. `GA4_SERVER_PURCHASE_ENABLED` خاموش می‌ماند.

## علت‌ها (evidence-first)

| مورد | علت اثبات‌شده |
|---|---|
| صفحهٔ سفید `/checkout` عمده | `CartProvider` در render اول `localStorage` می‌خواند → hydration mismatch (React #418) روی `/checkout`، `/`، `/products` هر وقت سبد پر بود؛ صفحه تا mount یا redirect مهمان چیزی رندر نمی‌کرد؛ GA داخل CartProvider بود. |
| page_view دوبل + توکن درگاه در `dl` | تگ Google کانتینر GTM خودش page_view خودکار با URL خام می‌فرستاد (Authority، paymentId)، علاوه بر page_view اپ. حتی بعد از `set` اولیه، اگر `config` اپ (منتظر `/settings/public` تا ۱.۲s) زودتر از `set {send_page_view:false}` در dataLayer می‌نشست، تگ کانتینر باز page_view می‌فرستاد (۲ از ۶ اجرا؛ ترتیب dataLayer ثبت شد). |
| MP «SENT» گمراه‌کننده | Google برای payload نامعتبر هم 2xx می‌دهد؛ 2xx فقط پذیرش transport است. |
| تناقض retry | cron هر ۵ دقیقه × ۵ تلاش با پنجرهٔ ۷۲ ساعت سازگار نبود؛ claim اتمیک نبود و SENDING گیرکرده بازیابی نداشت. |
| نشت پارامتر | eventها allowlist نداشتند؛ `page_path` و lead می‌توانستند query/فرم را حمل کنند. |
| invariant روزانه | `begin_checkout <= add_to_cart` روزانه غلط است (سبد روزهای قبل، تکرار). |

## تغییرات

### API
- `ga4-mp.ts`: `validatePurchaseBody` (transaction_id، currency=IRR، value صحیح، items غیرخالی، client_id، session_id، engagement_time_msec، timestamp_micros ≤72h، سقف ۲۵ پارامتر/طول ۱۰۰، `looksSensitive`)، `buildPurchaseBodyChecked`، `mpDebugUrl` (فقط CI)، `nextAttemptDelayMs` [1m,5m,15m,1h,3h,6h,12h,24h]، `isRetryableStatus` (4xx غیر 408/429 retry نمی‌شود)، `postPurchase`.
- `ga4-purchase.sql.ts` (جدید): claim دسته‌ای `UPDATE … FOR UPDATE SKIP LOCKED` + lease ۱۲۰s، بازیابی SENDING با lease منقضی، finish فنس‌شده (`status='SENDING' AND attempts=$n`)، sweep انقضای ۷۱h.
- `ga4-purchase.service.ts`: لاگ `ga4.purchase.transport_accepted` (بدون secret/URL/query/payload/payment id)؛ cron هر دقیقه، با فلگ خاموش no-op.
- migration `20261021-003-analytics-event-log-retry-lease`: `eventAt`، `nextAttemptAt`، `leaseUntil` (IF NOT EXISTS) + `IDX_analytics_event_log_status_next`؛ down کامل. UNIQUE `(eventName, transactionId)` دست نخورده.
- اسکریپت‌ها: `scripts/ga4-mp-validate.ts` (debug endpoint + `validation_behavior=ENFORCE_RECOMMENDATIONS`، `--invalid`)، `scripts/ga4-mp-concurrency.ts`.

### Web
- `lib/cart.tsx`: شروع خالی، HYDRATE در effect، `hydrated`.
- `app/checkout/page.tsx` + `layout.tsx`: پوستهٔ «در حال بارگذاری…»؛ مهمان: پیام + لینک ورود + redirect کنترل‌شده؛ سبد خالی: empty state با لینک `/products`؛ GA بیرون از CartProvider.
- `GoogleAnalyticsProvider.tsx`: مارکر SSR `data-ga-pageview-owner`.
- `DeferredGtm.tsx`: قبل از `gtm.js`، `gtag('set', {page_location پاک, send_page_view:false})` و `config` استریم پیش‌فرض با `send_page_view:false` روی مسیرهای اپ‌مالک؛ مسیرهای بدون GA اپ (`/portal`، `/confirm`، …) فقط `page_location` پاک‌شده.
- `GoogleAnalytics.tsx`: `bindGa4` قبل از `config`، `set {send_page_view:false}`؛ landing page_view حتی با unmount زودهنگام؛ `page_referrer` پاک‌شده.
- `lib/google.ts`: allowlist کوئری (utm_*، gclid، gbraid، wbraid)، `looksLikePii`، `sanitizeAnalyticsReferrer`، `preGtmGtagSet`، `defaultGa4IdFor`.
- `lib/retail-analytics.ts`: allowlist پارامتر per-event + enum برای lead (`lead_type`، `cta_location`، `business_type`، `referral`، `payment_type`)؛ allowlist آیتم؛ `cart_fp` و `cart_age_days`.
- `apps/web/e2e/`: Playwright (runner بیرون از repo؛ وابستگی جدید نیست).

## بازبینی مستقل (Reviewer + Security)

| یافته | اقدام |
|---|---|
| H1 حذف page_view کانتینر در سطح network اثبات نشده؛ تست network به‌جای fail، skip می‌شد | تست حالا fail می‌شود؛ network ۱۵/۱۵ بعد از همهٔ تغییرات؛ `send_page_view=false` در GTM و خاموش‌کردن history page view در Admin هم توصیه شد |
| M1 توکن در `dr` روی مسیر غیراپ‌مالک (401 → `/portal/login`) | `preGtmGtagSet` حالا `page_referrer` پاک‌شده می‌گذارد؛ unit test + e2e «callback → /portal/login» |
| M2 `set` سراسری بعد از ناوبری SPA می‌ماند؛ `send_page_view:false` سراسری روی `/portal` | `page_location` با هر تغییر مسیر دوباره ست می‌شود؛ `set send_page_view:false` فقط وقتی مارکر مالکیت هست |
| M3 خطا بعد از insert → PENDING می‌ماند → purchase دوبل ممکن | در مسیر خطا PENDING → CLIENT_FALLBACK؛ `ga4-purchase.error-path.spec.ts` |
| L1 lease دسته‌ای ۱۲۰s برای ۲۰ ردیف | دسته ۱۰ (≤۴۰s timeout) |
| L3 شمارهٔ سفارش ≥۱۰۰۰۰۰ با پسوند تمام‌رقمی شبیه کارت | فرمت `ORD-YYYY-N-HEX` معاف؛ تست |
| L4 claim ناقص | اصلاح شد |
| L2 override ادمین GA4 قبل از GTM | پذیرفته: `config` پیش از GTM برای استریم پیش‌فرض؛ override بعداً با `bindGa4` |
| L5 crash بعد از 2xx و قبل از finish | پذیرفته: at-least-once ذاتی؛ در runbook |

## گزارش cohort سبد (جایگزین invariant روزانه)

> اصلاح‌شده در TASK-20261021-003 (`docs/reports/2026-10-21-migration-lock-ga4-defs-host-logs.md`).

پیش‌نیاز GA4 Admin: فقط `cart_age_bucket` به‌عنوان custom dimension سطح event (۴ مقدار: `same_day`، `1_3_days`، `4_7_days`، `8_plus_days`) و `cart_age_days` فقط به‌عنوان custom metric عددی. `cart_fp` فقط برای dedupe در رویداد می‌ماند و **هرگز** custom dimension نمی‌شود؛ هیچ شناسهٔ سبد/session/user/transaction به‌صورت dimension پرکاردینال ثبت نشود.

Exploration (Free form، بازهٔ ۷/۲۸ روز):
1. نرخ شروع checkout: `begin_checkout` ÷ `add_to_cart` (Event count) به تفکیک `cart_age_bucket`.
2. سبدهای روزهای قبل: ردیف‌های `cart_age_bucket ≠ same_day` جدا گزارش شوند؛ begin_checkout این سبدها نسبت به add_to_cart همان روز سنجیده نشود.
3. میانگین سن سبد: metric `cart_age_days` ÷ Event count.
4. تکرار begin_checkout: کلاینت با `cart_fp` در sessionStorage dedupe می‌کند؛ بررسی تکرار فقط در BigQuery export (نه dimension).

## تست‌ها
- Web: `tsc --noEmit` سبز؛ `google.spec.ts ok`؛ `retail-analytics.spec.ts ok`.
- API: `ga4-mp.spec`، `20261021-001` و `-003` migration spec، `ga4-purchase.ownership.spec`، `payment-core.hardening`، `payment-concurrency.hardening`، `zarinpal-callback-status` سبز. (`npm test` کامل روی Windows به سقف طول خط cmd می‌خورد — از قبل روی master ۹۰۰۳ کاراکتر بود.)
- Concurrency روی Postgres 16 واقعی (کانتینر یک‌بارمصرف روی Hetzner، نه DB تولید): ۶ verify هم‌زمان → دقیقاً یک برنده؛ دو worker → 21+19 claim بدون تکرار؛ بازیابی lease منقضی یک‌بار؛ فنس stale رد شد؛ backoff؛ sweep انقضا؛ UNIQUE.
- Playwright محلی: ۱۳ pass، ۱ skip (PDP نیاز به کاتالوگ). تست‌های network بعد از همهٔ فیکس‌ها ۱۵/۱۵ (۵ تکرار × ۳ تست).
- `ga4-purchase.error-path.spec` سبز.

## Deploy (LIVE `ca5d232a`)

| | Hetzner `5.75.200.102` | replica ایران `185.213.167.61` (DNS زنده) |
|---|---|---|
| بکاپ قبل از migration | `backups/postgres/pre-ga4-hardening-20261021T143837Z` | `backups/pre-ga4-hardening-20261021-145401` (+ `files-before.tgz`) |
| تست restore در DB موقت | ۱۱۴ جدول / ۷ سفارش / ۹۱ migration = live | ۱۱۴ / ۷ / ۹۲ = live |
| سورس | git `ca5d232` | `SOURCE_SHA=ca5d232a-ga4-hardening` |
| chunk `/checkout` | `page-c9c158cc3d49ec32.js` | `page-c9c158cc3d49ec32.js` |
| migration 003 | اجرا شد (دو ردیف 124/125: race اجرای هم‌زمان api/worker/worker_b با `migrationsRun`؛ migration idempotent است، schema درست) | اجرا شد، یک ردیف (api اول، بعد worker) |
| UNIQUE `UQ_analytics_event_log_event_txn` + `IDX_…_status_next` + ستون‌ها | ✓ | ✓ |
| `GA4_SERVER_PURCHASE_ENABLED=true` | ندارد | ندارد |

- Hetzner: build اول با «no space left on device» شکست خورد (دیسک ۹۶٪). فقط journal (۳۴۶MB)، syslog چرخیده، کش apt/npm/pip پاک شد → ۳GB آزاد؛ deploy با `TARANOM_DEPLOY_FORCE=1` موفق. syslog جاری ۶۶۰MB است و سریع رشد می‌کند → بدهی.
- Smoke (هر دو origin واقعی): `api.poshaktaranom.com/v1/health` 200، `/checkout` 200، PDP 200، callback 200، هوم 200 (TTFB ۰.۲۹–۰.۵۸s از کلاینت).
- Playwright روی production (`E2E_BASE_URL=https://poshaktaranom.com`): **۱۴/۱۴ pass** شامل PDP. همهٔ hitها `tid=G-YVT5DXZF5Z`؛ هیچ توکنی در dl/dp/dr.
- Rollback: `pg_restore` از بکاپ بالا (تست شده) یا `down()` migration 003؛ replica: `tar -xzf files-before.tgz` + build.

## بدهی فنی
- `migrationsRun` در هر سه پروسس api/worker/worker_b → race؛ فقط api یا advisory lock.
- `npm test` در `apps/api` روی Windows از سقف ۸۱۹۱ کاراکتر cmd بیشتر است (از قبل).
- دیسک Hetzner و syslog پرحجم.

## کارهای فقط در GA4/GTM Admin
- Accept MP terms + ساخت API secret هر استریم (برای `ga4-mp-validate` و فعال‌سازی بعدی فلگ).
- Custom dimension: فقط `cart_age_bucket`؛ custom metric: `cart_age_days` (نه `cart_fp`).
- Enhanced measurement: «Page changes based on browser history events» خاموش (اپ SPA page_view را خودش می‌فرستد).
- Key events و internal traffic (IP دفتر).
- الزامی (TASK-003): `send_page_view=false` روی Google tag هر دو کانتینر.
