# Omnichannel daily CREATE overshoot — RCA + fix (2026-10-13)

## Symptom

ربات تلگرام عمده بیش از سقف روزانه پست می‌فرستد. تنظیمات: `autoDailyCap: 10`.

## Live evidence (VPS, Tehran day)

| Metric | Value |
| --- | --- |
| Cap | **10** |
| UI-style SUCCEEDED CREATE today | **17** |
| PENDING CREATE still queued | **16** (`auto=false`) |
| Gate counter (`auto=true` only, before fix) | **2** |

Almost all overshoot came from category/manual blasts stamped `auto: false`.

## Root cause

1. `evaluateAutomationGate` daily_cap only saw `automationCounters`, which counted **`payload.auto = true`** outbox CREATEs.
2. `requeueByCategory` / manual publish documented **bypass** of daily_cap and enqueued with `auto: false`.
3. UI `sentTodayCount` counted all SUCCEEDED CREATEs → admin saw 17/10 while automation still thought room remained (2/10).

## Fix

- Cap counter = distinct CREATE publications today with status in `PENDING|PROCESSING|RETRY|SUCCEEDED` (any `auto` flag), per channel.
- Category requeue and manual CREATE respect remaining room; dry-run exposes `dailyRoom`.
- Soft-cancel excess PENDING CREATE after deploy when already over the cap.

## Owner

Hard-refresh `/admin/omnichannel` — «پست‌های امروز» باید با سقف هم‌خوان باشد؛ ارسال دسته با صف خالی وقتی room=0 خطا می‌دهد.
