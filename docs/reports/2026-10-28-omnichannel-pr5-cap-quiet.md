# 2026-10-28 — Omnichannel PR-5: ساعت سکوت هنگام claim

**شاخه:** `feat/omnichannel-pr5-cap-quiet` (از `origin/master` = `4b6ad795`، شامل PR-4 #124) · **Merge/Deploy:** فقط با GO نوشتاری حامد · برنامه: `docs/design/omnichannel-redesign/pr5-cap-quiet-plan.md`

سقف روزانه، فاصلهٔ حداقل و rate-limit قبلاً در `reserveCreateSend` اعمال می‌شد. فقط **ساعت سکوت** هنگام claim نبود: ردیف صف‌مانده می‌توانست داخل پنجرهٔ سکوت ارسال شود. این PR همان شکاف را می‌بندد.

## تغییرات

| # | تغییر | فایل |
| --- | --- | --- |
| 1 | `decideQuietHours(now, start, end)` خالص؛ هر دو ساعت لازم است، پنجرهٔ ناقص/برابر = خاموش (همان قاعدهٔ `evaluateAutomationGate`)؛ `availableAt = nextQuietEnd` | `delivery-idempotency.ts` |
| 2 | `planCreateSend` بعد از supersede/stale-HOLD و **قبل از** cap/gap/rate، defer با `quiet_hours` برمی‌گرداند. `quietStartHour` اختیاری است (فراخوان‌های قدیمی = بدون گیت) | `delivery-idempotency.ts` |
| 3 | `reserveCreateSend` ساعت شروع/پایان سکوتِ تنظیمات resolveشدهٔ **همان مقصد** را به plan می‌دهد؛ `DEFER_CREATE_SQL` همان مسیر قبلی. پارامتر اختیاری `now` فقط seam تست است | `omnichannel.service.ts` |
| 4 | `nextCreateAvailableAt`: بعد از gap/cap اگر اسلات داخل سکوت بیفتد → پایان سکوت، `reason='quiet_hours'` (هم‌راستا با claim)؛ پارامتر اختیاری `now` | `omnichannel.service.ts` |
| 5 | `quiet_hours` در `DELIVERY_DEFERRED_REASONS` | `omnichannel.constants.ts` |

بدون تغییر: SQL شمارش/claim (castهای `::uuid`/`::timestamptz`/`::text` برای 42P08)، worker، adapterها، web، migration، env.

## تست

- جدید: `services/delivery-quiet-claim.spec.ts` (ثبت‌شده در `scripts/unit-specs.txt`):
  - خالص: داخل 23→08 defer، بیرون send، پنجرهٔ ناقص خاموش، ترتیب supersede > stale > quiet > cap، پنجرهٔ غیرعبوری، رگرسیون jitter `decideDailyCap`.
  - `reserveCreateSend` واقعی با harness: 23:30 تهران → defer، `deferredReason=quiet_hours`، `nextAttemptAt=08:00`، صفر claim (صفر adapter)، ردیف PENDING؛ سه مقصد با تنظیمات متفاوت مستقل؛ تنظیمات resolveنشده پنجره نمی‌سازد.
  - `nextCreateAvailableAt`: داخل پنجره = پایان سکوت؛ gap که وارد پنجره شود؛ rollover سقف روزانه.
  - guard منبع: castها، نبود `attempt_started`/`lease_until`، worker همچنان از `DeliveryDeferredError` استفاده می‌کند.
- اجرا شده: `npm test` در `apps/api` → `unit-specs: 160 ok` (integration Postgres: skipped بدون `DATABASE_URL`)؛ `tsc --noEmit` api بدون خطا.

## ریسک و بازگشت

- رفتار: CREATEهای دستی/خودکار/requeue/retry که داخل پنجرهٔ سکوت مقصد fire شوند حالا تا پایان سکوت منتظر می‌مانند (قبلاً می‌رفتند). انتشار دستی کاتالوگ در enqueue هنوز سکوت را رد می‌کند (عمدی، D-6)، ولی claim قطعی است. اپراتور باید بداند «ارسال دستی در شب» تا صبح می‌ماند.
- پس از پایان سکوت همهٔ ردیف‌های معوق هم‌زمان آزاد می‌شوند؛ cap/min-gap/rate همان claim آن‌ها را پخش می‌کند.
- بازگشت: `git revert`؛ migration ندارد. ردیف‌های با `deferredReason=quiet_hours` PENDING/RETRY می‌مانند و بی‌ضررند.

## باز / بعدی

- برچسب فارسی `quiet_hours` در `admin-omnichannel-ui.tsx` (نقشهٔ دلایل) اضافه نشد چون `apps/web` طبق برنامه خارج از دامنه است (PR-10)؛ تا آن موقع UI کلید خام را نشان می‌دهد.
- D-2 (HOLD در سقف حساب می‌شود)، D-3 (rate per connection)، D-4 (بدون گیت mode OFF در claim) تغییر نکرد؛ تصمیم مالک لازم است.
- `attempt_started`/`lease_until` طبق دستور این PR اضافه نشد (یادداشت گزارش PR-4 که «همراه PR-5» نوشته بود منسوخ است).
- تست integration Postgres (defer در claim) اضافه نشد؛ فقط harness درون‌حافظه.
