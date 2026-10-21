# TASK-20261021-003 — race مایگریشن، تعاریف GA4، مالکیت page_view، پایداری Hetzner

پیگیری بازبینی TASK-20261021-002. Analytics بازطراحی نشد؛ فقط موارد خواسته‌شده.

## ۱. race مایگریشن (P0)

**چرا 003 روی Hetzner دو ردیف ساخت:** در production هر سه پروسس api، worker و worker_b همان image و `migrationsRun: true` داشتند و `docker compose up -d api web worker worker-b` هر سه را هم‌زمان بالا آورد. TypeORM قفل بین‌پروسسی ندارد: هر پروسس جدول `migrations` را خواند، 003 را pending دید، آن را در تراکنش خودش اجرا کرد و ردیف history خودش را درج کرد. چون 003 idempotent است (`IF NOT EXISTS`) هر دو تراکنش commit شدند؛ اگر نبود، دومی rollback می‌شد. همین الگو ۱۴ ردیف تکراری تاریخی (۱۳ مورد قدیمی + 003 روی Hetzner / `SalesPartnerDraftExpiryIndex` روی replica) ساخته بود. replica فقط یک ردیف 003 داشت چون آنجا api جدا از worker بالا آمد.

**بکاپ قبل از تغییر (restore-check با TOC شامل دادهٔ `migrations`):**
- Hetzner: `backups/postgres/pre-migration-dedupe-20261021T163737Z` (۵۷۷ ورودی TOC)
- replica: `backups/pre-migration-dedupe-20261021-163741`

**پاک‌سازی (هر دو DB، یک تراکنش، `LOCK TABLE migrations IN EXCLUSIVE MODE`):** اول schema 003 چک شد (۳ ستون timestamptz، `IDX_analytics_event_log_status_next`، `UQ_analytics_event_log_event_txn`)؛ بعد فقط ردیف‌های history با `id <> min(id)` به ازای `(timestamp, name)` حذف شد؛ assert: حذف=۱۴، distinct=۷۹، total=۷۹، dup=۰، سپس COMMIT. هیچ ستون/ایندکس/constraint حذف نشد.

```sql
SELECT timestamp, name, COUNT(*) FROM migrations GROUP BY timestamp, name HAVING COUNT(*) > 1;
```
| | قبل | بعد |
|---|---|---|
| Hetzner | ۱۴ ردیف (۹۳ total / ۷۹ distinct) | **0 rows** (۷۹/۷۹) |
| replica | ۱۴ ردیف (۹۳ / ۷۹) | **0 rows** (۷۹/۷۹) |

آشتی history: `md5(string_agg(timestamp||name ORDER BY timestamp,name))` هر دو `17dbf4e00066cb207849221846b1ff6b|79` — یکسان.

**فیکس کد (بدون migration جدید):**
- `apps/api/src/database/run-migrations.ts`: `runMigrationsWithLock` روی connection اختصاصی `pg_advisory_lock(7261021003)` می‌گیرد، `runMigrations()` و بعد unlock.
- `database.config.ts`: `migrationsRun: false` برای همه؛ `migrationRunnerEnabled()` فقط در production/staging، نه وقتی `OMNICHANNEL_WORKER=true`، نه وقتی `TYPEORM_MIGRATIONS_RUN=false`.
- `main.ts`: قبل از `NestFactory.create` (فقط api). `worker.main.ts` هیچ مسیر migration ندارد.
- `docker-compose.yml`: api `TYPEORM_MIGRATIONS_RUN: 'true'`؛ worker و worker-b `'false'`.
- تست: `run-migrations.spec.ts` (ماتریس فعال‌سازی + ترتیب main + env compose) به `npm test` اضافه شد؛ `scripts/migration-lock-race.ts` روی Postgres یک‌بارمصرف: بدون قفل ۳ ردیف، با قفل ۱ ردیف.

## ۲. تعاریف GA4

- `cart_fp` فقط برای dedupe در رویداد می‌ماند؛ **custom dimension نمی‌شود**.
- `cart_age_bucket` (dimension سطح event، ۴ مقدار ثابت): `same_day` (۰)، `1_3_days`، `4_7_days`، `8_plus_days`. allowlist دقیق (case-sensitive)؛ مقدار دیگر حذف می‌شود.
- `cart_age_days` فقط custom metric عددی.
- هیچ شناسهٔ سبد/session/user/transaction به‌صورت dimension پرکاردینال ثبت نمی‌شود.
- تست: `retail-analytics.spec.ts` (mapping ‏0/1/3/4/7/8/400، رد `'2_days'`, `'9'`, `'SAME_DAY '`)؛ e2e: `begin_checkout.cart_age_bucket === '1_3_days'`.

## ۳. page_view

- `send_page_view=false` در Google tag هر دو کانتینر GTM الزامی شد (retail `GTM-NKBCGQJV` از قبل؛ wholesale `GTM-M3LQFGZV` در این تسک).
- **ریسک کشف‌شده:** روی دامنهٔ عمده مسیرهای `/portal` (ورود/ثبت‌نام)، `/partners` و `/sales-partners` بدون marker مالکیت بودند و page_view را از خود GTM می‌گرفتند؛ با `send_page_view=false` صفر می‌شدند. فیکس: `GoogleAnalyticsProvider channel="WHOLESALE"` در layout این سه مسیر. `/confirm/*` که توکن در path دارد کلاً بدون GTM/GA شد (مثل `/admin`) — قبلاً GTM آن URL را در `dl` می‌فرستاد.
- دامنهٔ تکی: همهٔ مسیرها زیر `/retail` و `/payment` اپ‌مالک‌اند.
- trade-off: صفحهٔ 404 ریشه marker ندارد → page_view ندارد.

## ۴. پایداری Hetzner

**منبع رشد syslog (۶۶۵MB در ۳.۵ روز):** `lead-api.service` (پروژهٔ جدا) هر ۷ ثانیه crash می‌کرد (۲۴۵ هزار restart؛ `lead_postgres` از ۵ هفته پیش متوقف است)، لاگ DEBUG ‏`warp-svc` (Cloudflare WARP)، و xray.

`scripts/install-host-log-hardening.sh` (idempotent؛ نسخهٔ قبلی فایل‌ها در `/var/backups/taranom-host`):
- logrotate خانوادهٔ syslog: `daily`، `maxsize 100M`، `rotate 7`، `compress`؛ تایمر logrotate ساعتی (تا maxsize واقعاً اعمال شود).
- journald: `SystemMaxUse=300M`، `MaxRetentionSec=14day`.
- rsyslog: `warp-svc` فقط در journal (سقف‌دار)، نه syslog.
- `lead-api`: drop-in ‏`RestartSec=600` (فعال می‌ماند، فقط loop کند شد).
- `/etc/docker/daemon.json`: `json-file` با `max-size 10m`، `max-file 3`؛ compose هم برای همهٔ سرویس‌ها (postgres/redis/meili/minio/web/nginx) همین سقف را دارد (meili ۳۴۴MB و postgres ۱۷۴MB بی‌سقف بودند).
- هشدار دیسک: `scripts/disk-alert.sh` هر ۱۰ دقیقه (cron root)؛ ۸۰٪ warning، ۹۰٪ critical، recovery؛ syslog (`taranom-disk-alert`) + `/var/lib/taranom/disk-alert.log`؛ push تلگرام فقط اگر `DISK_ALERT_TELEGRAM_CHAT_ID` در `.env` باشد (فعلاً تنظیم نشده). هر سه مسیر روی سرور تست شد.
- فضا: restart کنترل‌شدهٔ dockerd (کانتینرها در ۴۵ ثانیه healthy) leaseهای stale بیلدکش را آزاد کرد (12.6GB → 3.9GB) و prune شد. **۲.۸GB → ۱۶GB آزاد (۹۳٪ → ۵۸٪).** هیچ بکاپی حذف نشد.
- سیاست retention بکاپ: `backup-postgres.sh` روزانه 02:15 با `BACKUP_KEEP_DAYS=14` (پیش‌فرض)؛ پوشه‌های `pre-*` دستی‌اند و حذف خودکار نمی‌شوند. فایل‌های `/tmp/cutover-*` (۱.۵GB، بکاپ MinIO زمان cutover) دست نخوردند.

## ۵. فلگ
`GA4_SERVER_PURCHASE_ENABLED` روی هر دو سرور تنظیم نشده (= false).

## Deploy و تست production

| | Hetzner `5.75.200.102` | replica ایران `185.213.167.61` (DNS زنده هر دو دامنه) |
|---|---|---|
| سورس | git `80c10ad508f126090d58442c6bf9e6f11a75cd1c` (auto-deploy) | `SOURCE_SHA=80c10ad5-task003` (patch ۱۷ فایل، بکاپ `backups/pre-task003-20261021-165110/files-before.tgz`) |
| web `BUILD_ID` | `hwTFR9t0IE8IOc9V840oU` | `dxoctNz9jqQ0mdSHVmmz_` |
| `TYPEORM_MIGRATIONS_RUN` | api `true`، worker `false`، worker_b `false` | api `true`، worker `false` (worker_b روی replica اجرا نمی‌شود) |
| لاگ بعد از boot | فقط api: `{"event":"migrations.done","count":0}`؛ workerها ۰ خط migration | همان |
| کوئری dup بعد از deploy | 0 rows، ۷۹/۷۹ | 0 rows، ۷۹/۷۹ |
| سقف لاگ کانتینر | هر ۹ کانتینر `max-size 10m, max-file 3` | فقط api/worker (سرویس‌های زیرساخت با `--no-deps` بازسازی نشدند) |
| `GA4_SERVER_PURCHASE_ENABLED` | تنظیم نشده (false) | تنظیم نشده (false) |
| دیسک | ۱۲GB آزاد (۶۸٪) بعد از build | ۴۶GB آزاد (۴۱٪) |

GTM منتشرشده (از `gtm.js` زنده): `GTM-M3LQFGZV` نسخهٔ ۴ و `GTM-NKBCGQJV` نسخهٔ ۳، هر دو `vtp_configSettingsTable: send_page_view=false`. انتشار عمده عمداً بعد از deploy کد انجام شد تا `/portal` حتی چند دقیقه بی page_view نماند. marker مالکیت در HTML ‏`/portal/login`، `/partners/login`، `/sales-partners/login` (WHOLESALE) و هوم تکی (RETAIL) تأیید شد.

Playwright روی production (`E2E_BASE_URL=https://poshaktaranom.com`، hitها محلی جواب داده می‌شوند و به GA نمی‌رسند): **۱۸/۱۸ pass**. spec جدید `e2e/pageview-network.spec.ts` در سطح شبکه برای هر دامنه جدا:
- عمده: `/checkout` → یک page_view (`G-YVT5DXZF5Z`)؛ کلیک SPA به `/products` (بدون reload سند) → دقیقاً یکی دیگر. callback با `Authority/paymentId` → یک page_view با `dl=https://poshaktaranom.com/payment/callback` بدون query.
- تکی: `/` → یک page_view (`G-F2V7VSJMLE`)؛ SPA به `/products` → دقیقاً یکی دیگر. callback → یک page_view با `dl=https://www.poshaktaranom.ir/payment/callback`.
- هیچ hit به استریم دیگر؛ هیچ `authority|paymentid|trackingcode|token` در dl/dp/dr؛ `/portal/login` با referrer توکن‌دار → یک page_view با dr پاک.

Smoke: `api.poshaktaranom.com/v1/health` 200 (0.49s)، هوم عمده 200 (0.83s)، `/portal/login` 200، هوم تکی 200 (0.88s)، callback تکی 200.

Rollback: کد ← `git revert 274ec218` + deploy؛ GTM ← نسخهٔ ۳ کانتینر عمده را republish (اما قبلش revert کد، وگرنه دو page_view)؛ host ← فایل‌های `/var/backups/taranom-host/*` و حذف drop-inها.

## باز / خارج از این تسک
- push تلگرام هشدار دیسک: `DISK_ALERT_TELEGRAM_CHAT_ID` در `.env` Hetzner لازم است.
- ثبت custom dimension ‏`cart_age_bucket` و metric ‏`cart_age_days` در GA4 Admin هر دو property (دستی).
- `order-money-guard.spec.ts` (کامیت `8bb51acd`، خارج از این تسک) در `tsc -p apps/api` خطای narrowing دارد.
- `lead-api` و `lead_postgres` (پروژهٔ جدا) خاموش/خراب‌اند؛ فقط loop کند شد.
