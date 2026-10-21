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
(بعد از deploy تکمیل می‌شود.)
