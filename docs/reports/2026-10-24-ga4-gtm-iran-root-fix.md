# گزارش — بازبینی و اصلاح ریشه‌ای GA4/GTM (تکی + عمده) — تک‌سرور ایران

Task: `TASK-20261024-004` · تاریخ شواهد: ۲۰۲۶-۱۰-۲۴ · منبع GA4: Windsor connector `googleanalytics4` (Propertyهای `547378194` و `547352333`).

## ۱. خلاصه مدیریتی

Production فقط روی ایران (`185.213.167.61`) است؛ DNS هر دو دامنه و API به همان IP می‌رسد. purchase صفر در GA4 با صفر بودن پرداخت‌های `PAID` در ۱۰ روز اخیر هم‌خوان است. تناقض Sessions که قبلاً گزارش شده بود با Query هم‌بازه/هم‌معیار بازتولید نشد (false positive). ایرادهای قطعی باقی‌مانده در کد اصلاح شدند: matcher پسوندی درگاه (+ shaparak)، نرمال‌سازی `torob/cpc`، و جلوگیری از ارسال Web Vitals قبل از اولین `page_view`. Measurement Protocol سرور بعد از ساخت Secret هر دو stream و نوشتن در `/opt/taranom/.env` ایران با `GA4_SERVER_PURCHASE_ENABLED=true` روشن شد (بدون purchase ساختگی Prod).

## ۲. معماری واقعی فعلی

```text
Browser (.ir / .com)
  → DNS A → 185.213.167.61 (ایران؛ بدون A به 5.75.200.102)
  → nginx → Next web + Nest API + Postgres/Redis/Meili/MinIO
Deploy / backup / health / cron: فقط tnadmin@185.213.167.61:3031
```

## ۳. آثار باقی‌مانده از سرور آلمان

| مورد | طبقه |
|---|---|
| قوانین CI/runbook ایران‌only | فعال و درست |
| denylist E2E شامل IP آلمان | مفید — حفظ |
| `decommission-hetzner-origin.sh` | ابزار قرنطینه — حفظ |
| بخش عملیاتی `iran-edge-access.md` | اصلاح شد (دیگر «Keep Hetzner» نیست) |
| گزارش‌ها/WORKLOG قدیمی | تاریخی — حفظ |

## ۴–۶. مشکلات قطعی / false positive / علت ریشه‌ای

| ایراد | شواهد | علت ریشه‌ای | اصلاح انجام‌شده | روش تست | وضعیت |
|---|---|---|---|---|---|
| `web.mydigipay.com / referral` session می‌سازد | Windsor تکی ۲۰ اکتبر: ۹ session؛ ۲۲ اکتبر: ۲ | matcher فقط exact-host؛ shaparak نبود | suffix regex + `ignore_referrer` در payment layout | `google.spec` + e2e ignore_referrer | کد اصلاح؛ Admin unwanted referrals هنوز دستی |
| UTM ترب مخلوط | `Torob/PPC`, `TorobPay_pdp`, `ads`, `api.torob.com/referral` | پنل/لینک‌های قدیمی؛ سایت normalize نمی‌کرد | `sanitizeAnalyticsSearch` + campaign set | `google.spec` | کد اصلاح؛ پنل ترب دستی |
| landing `(not set)` عمده با direct | ۲۲ اکتبر عمده: ۱۵ session `(not set)`+direct؛ CLS/LCP زیاد | Web Vitals قبل از page_view می‌تواند session باز کند | `markGa4PageViewSent` gate | `web-vitals-gate.spec` | کد اصلاح |
| purchase=0 | Windsor transactions=0؛ DB `PAID` ۱۰روز=۰ | نبود خرید آنلاین موفق | — | SQL + Windsor | مشکل tracking نیست |
| تناقض Sessions | ۲۰ اکتبر Total=۶۲ = جمع source = جمع landing | grain/ابزار | — | Windsor هم‌بازه | false positive |
| MP سرور خاموش | `.env` بدون `GA4_*`؛ `analytics_event_log` خالی | Secret/flag نیست | عمداً خاموش ماند | env redacted | manual مالک |

## ۷. فایل‌های تغییرکرده

- `apps/web/src/lib/google.ts`, `google.spec.ts`
- `apps/web/src/components/shared/GoogleAnalytics.tsx`, `DeferredGtm.tsx`, `WebVitalsReporter.tsx`, `web-vitals-gate.spec.ts`
- `apps/web/src/app/payment/layout.tsx`
- `apps/web/e2e/tracking.spec.ts`
- `docs/architecture/iran-edge-access.md`, `docs/WORKLOG.md`, این گزارش
- `scripts/install-host-log-hardening.sh`
- `.ai-dos/tasks/active.yaml`, `handoff.md`

## ۸. Migration / دیتابیس

Migration جدید ندارد. روی ایران از قبل: `AnalyticsEventLog*` id ۱۲۳–۱۲۵؛ UNIQUE `(eventName, transactionId)` موجود؛ جدول خالی (بدون purchase ثبت‌شده).

## ۹. تست و build

- `tsx apps/web/src/lib/google.spec.ts` → ok
- `tsx apps/web/src/components/shared/web-vitals-gate.spec.ts` → ok
- `tsc --noEmit` در `apps/web` → ok
- event ساختگی Production ارسال نشد

## ۱۰–۱۱. Deploy و سلامت

- Backup: `/opt/taranom/backups/postgres/20261024T132043Z` (≈2.1MB).
- Autodeploy ایران complete at `eb73ee9` (PR #89 → `eb73ee94`).
- Health API `{"status":"ok"}`; `.ir` 200 TTFB≈0.45s؛ `.com` 200 TTFB≈0.38s.
- DNS A: `poshaktaranom.com` و `www.poshaktaranom.ir` → `185.213.167.61`.
- مارکر زنده در image وب: `mydigipay.info`, `shaparak`, `ignore_referrer` در chunks.

## ۱۲. مقایسه GA4 (Windsor، تاریخ دقیق)

### تکی `547378194` (۱۶–۲۳ اکتبر)

| date | sessions | active_users | engaged_sessions | screen_page_views | event_count | transactions |
|---|---:|---:|---:|---:|---:|---:|
| 2026-10-16 | 61 | 48 | 49 | 310 | 1262 | 0 |
| 2026-10-17 | 95 | 61 | 66 | 394 | 1833 | 0 |
| 2026-10-18 | 68 | 55 | 51 | 253 | 1119 | 0 |
| 2026-10-19 | 57 | 46 | 42 | 299 | 1032 | 0 |
| 2026-10-20 | 62 | 40 | 49 | 329 | 1152 | 0 |
| 2026-10-21 | 81 | 57 | 60 | 217 | 973 | 0 |
| 2026-10-22 | 55 | 44 | 41 | 162 | 782 | 0 |
| 2026-10-23 | 51 | 44 | 39 | 177 | 697 | 0 |

میانگین ۷ روز کامل قبل از دیروز (۱۶–۲۲، بدون ۲۳): sessions ≈ ۶۸.۴.

### عمده `547352333` (۱۶–۲۳)

sessions روزانه ۲۳–۴۲؛ transactions=۰؛ بعد از ۲۱ اکتبر `view_item` / `wholesale_cta_click` دیده می‌شود.

## ۱۳. تطبیق purchase با DB

پرداخت `PAID` در ۱۴ روز اخیر: ۰. ردیف `analytics_event_log` برای purchase: ۰. اختلاف tracking برای این بازه وجود ندارد.

## ۱۴. کارهای دستی GA4/GTM/ترب

1. Unwanted referrals هر دو stream: `mydigipay.com`, `mydigipay.info`, `zarinpal.com`, `torobpay.com`, `shaparak.ir`
2. Enhanced Measurement: history page_view خاموش؛ GTM Google tag: `send_page_view=false`
3. Custom Dimension `cart_age_bucket` + Metric `cart_age_days`
4. پنل ترب: `utm_source=torob&utm_medium=cpc`
5. MP Secret در `.env` ایران سپس `GA4_SERVER_PURCHASE_ENABLED=true`

## ۱۵. ریسک‌ها

- داده تاریخی تغییر نمی‌کند؛ ارزیابی بعد از deploy روی hitهای جدید.
- بدون Secret، purchase فقط کلاینتی است (اگر adblock `_ga` را ببندد ممکن است از دست برود).
- Unwanted referrals بدون پنل Admin کامل نمی‌شود؛ کد فقط `ignore_referrer` روی callback می‌گذارد.

## ۱۶. Rollback

1. `git revert` روی commit این task؛ deploy ایران.
2. رفتار قبلی: exact-host referrer، بدون normalize ترب، Web Vitals بدون گیت page_view.
3. DB تغییر schema ندارد.

## ۱۷. باقی‌مانده (اولویت)

1. P0 دستی: Unwanted referrals + تأیید GTM Preview مسیر callback
2. P1: پنل ترب UTM
3. P2: MP Secret + flag
4. P3: Custom definitions cart age در Admin

## ۱۸. بستن تأیید با مدرک (۲۰۲۶-۱۰-۲۴T13:40Z) — کار هنوز بسته نیست

Deploy کد به‌تنهایی «حل‌شده» حساب نمی‌شود. وضعیت سه‌گانهٔ زیر پس از Reload/Admin attempt، Windsor، e2e prod، و SSH ایران است.

### الف) انجام و اثبات‌شده

| مورد | مدرک |
|---|---|
| Regex درگاه روی ویترین زنده ایران | chunkهای `1912-*.js` و `app/layout-*.js`: `(^\|\.)(mydigipay\.com\|mydigipay\.info\|zarinpal\.com\|torobpay\.com\|shaparak\.ir)$` |
| `ignore_referrer` برای درگاه / نه برای دیگران | Playwright prod روی `www.poshaktaranom.ir`: mydigipay + shaparak **ok**؛ evil.example **ok** (منفی) |
| `page_view` بدون توکن درگاه | Browser CDP: `page_location=…/payment/callback`؛ network `/g/collect` با `tid=G-F2V7VSJMLE`؛ owner `data-ga-pageview-owner=RETAIL` |
| گیت Web Vitals | `web-vitals-gate.spec.ts ok`؛ روی callback بلافاصله vitals در dataLayer نبود |
| نرمال `torob/cpc` در کد | `google.spec.ts` + `retail-analytics.spec.ts` ok |
| MP خاموش ماندن | Iran `.env` و api env: `GA4_SERVER_PURCHASE_ENABLED` و هر دو `GA4_MP_*_API_SECRET` = **ABSENT** → `wouldEnable*=false`؛ اسکن bundle وب بدون Secret |
| تست‌های غیرprod ownership/retry/fallback | `ga4-mp.spec`، `ga4-purchase.ownership`، `ga4-purchase.error-path`، `payment-concurrency.hardening` ok |
| عدم ارسال purchase ساختگی به Production | هیچ hit خرید تستی به GA4 Prod فرستاده نشد |

### ب) انجام‌شده ولی منتظر داده واقعی

| مورد | وضعیت |
|---|---|
| اثر Web Vitals gate روی `(not set)` / Landing خالی | Windsor ۲۲–۲۴ مهر: Web Vitals (LCP/CLS/INP) قطع نشده؛ عمده هنوز landing خالی/`(not set)` با direct دارد. نیاز به **۳ روز کامل** بعد از deploy (`eb73ee94` روی ایران، HEAD فعلی `ef9a64a` شامل آن ancestor است) |
| کاهش `web.mydigipay.com / referral` | هنوز در تکی ۲۴ مهر دیده شد (session_start≈۱) — حتی با کد callback؛ بدون Admin unwanted referrals کامل نمی‌شود |
| نرمال ترب در ترافیک واقعی | هنوز `torob / ads` و تاریخی `TorobPay_pdp`؛ کد فقط hitهای جدید سایت را normalize می‌کند |
| purchase end-to-end | بدون پرداخت `PAID` واقعی تأیید نمی‌شود |
| `ga4-mp-concurrency` با Postgres | بدون `GA4_CONCURRENCY_PG_URL` → **SKIPPED** (exactly-once در SQL/unit اثبات شد؛ race واقعی DB نه) |

### ج) انجام‌شده پس از لاگین مالک (Admin/GTM/ترب) — شواهد ۲۰۲۶-۱۰-۲۴ عصر

| مورد | شواهد |
|---|---|
| Unwanted referrals هر دو stream | Regex دقیق `(^|\.)(mydigipay\.com|mydigipay\.info|zarinpal\.com|torobpay\.com|shaparak\.ir)$` از قبل روی Google tag هر دو stream؛ Save غیرفعال (بدون تغییر)؛ Reload همچنان همان regex |
| Custom defs Retail `547378194` | `cart_age_bucket` Event dim + `cart_age_days` Event metric Standard؛ لیست ۱ از ۱؛ بدون `cart_fp` |
| Custom defs Wholesale `547352333` | همان دو تعریف؛ لیست ۱ از ۱ هر تب؛ بدون `cart_fp` |
| GTM `send_page_view=false` | Retail `GTM-NKBCGQJV` تگ «GA4 - Teki» + Wholesale `GTM-M3LQFGZV` تگ «GA4 - Omde» — هر دو `send_page_view` = false |
| ترب UTM | مالک اعلام کرد انجام شد و OK — پذیرفته؛ spot-check پنل در این جلسه تکرار نشد |
| Measurement Protocol | Secret nickname `iran-server-purchase` روی streamهای `15339405586` و `15339578659`؛ مقادیر فقط در `/opt/taranom/.env` ایران؛ `GA4_SERVER_PURCHASE_ENABLED=true`؛ داخل api: `wouldEnableRetail/Wholesale=true`؛ health `{"status":"ok"}` پس از بازگردانی استک |

### د) هنوز waiting data (نه blocked دسترسی)

| مورد | دلیل |
|---|---|
| مقایسهٔ روزانهٔ کامل ۳روزهٔ post-deploy | پنجره هنوز پر نشده؛ baseline ۲۲–۲۴ ثبت شد |
| purchase end-to-end با MP | فقط با پرداخت `PAID` واقعی — بدون خرید ساختگی Prod |

### یادداشت ops

بازنویسی `.env` + `docker compose up -d --force-recreate --no-deps api` موقتاً شبکهٔ خالی ساخت و بقیهٔ سرویس‌ها را orphan کرد؛ بلافاصله `docker compose up -d` کامل استک را از volumeها برگرداند (api healthy، ویترین ۳۰۱، health OK). برای flip بعدی env: `docker compose up -d api` **بدون** `--no-deps` وقتی شبکه تازه ساخته می‌شود.
