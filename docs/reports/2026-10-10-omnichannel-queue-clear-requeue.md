# Omnichannel — خالی کردن صف + ارسال مجدد بر اساس دسته

**Task:** TASK-20261010-005  
**Depth:** skill-top کامل + ECC + H2H  
**Architect:** [Architect clear+requeue](6af9b6d7-b009-4903-8eaf-5119a578a3d8)  
**Explore:** [Map omnichannel queue APIs](5996deb7-5cd3-4555-a1f8-26eeb5f0e221)  
**Security:** [Security review](e4baf290-8ecc-49ef-a3bc-d88b4c45c3a6) — PASS WITH CONDITIONS → canary + WITHDRAWN patched  
**Phase review:** [Phase review](ea0441d1-84d3-4744-809a-c918e429bfe6) — PASS WITH CONDITIONS

## Goal

ادمین بتواند کل صف انتظار را (نرم) خالی کند و ارسال محصولات یک دسته را از نو شروع کند؛ باگ‌های متریک و withdraw-after-enqueue هم بسته شوند.

## Root causes (live symptoms)

| Symptom | Cause |
| --- | --- |
| ۷۹ در انتظار | همهٔ PENDING (شامل موکول‌شده با `availableAt`) |
| ۳۹ متوقف | DEAD بعد از max attempts |
| ۵ ارسال ناموفق | شمارش DEAD در ۱۰۰ delivery اخیر (نه فقط امروز) |
| DRAFT زیاد | reconcile/sync بدون enqueue + daily_cap |

## Changes

| Layer | Change |
| --- | --- |
| API | `POST /v1/omnichannel/outbox/clear-waiting` — PENDING→DONE + `cancelled_by_admin`; stale PROCESSING؛ delivery مرتبط→DEAD؛ **بدون DELETE** |
| API | `POST /v1/omnichannel/publications/requeue-by-category` — dryRun/live، سقف ۱۰۰، فاصلهٔ `autoMinGapSeconds`، کانال اجباری |
| API | Canary: در حالت غیر LIVE سقف محصول رعایت می‌شود؛ WITHDRAWN دوباره باز نمی‌شود |
| Worker | CREATE/UPDATE روی publication با وضعیت WITHDRAWN رد می‌شود |
| Metrics | `outboxMetrics` فقط PENDING/PROCESSING/DEAD (دیگر `take:2000` از DONE نمی‌خورد) |
| Web | دکمهٔ «خالی کردن صف انتظار» + بخش «شروع دوباره بر اساس دسته» |

## Validation

```text
cd apps/api
npx ts-node --transpile-only src/modules/omnichannel/bulk-requeue-category.spec.ts
→ ok
npx ts-node --transpile-only src/modules/omnichannel/services/outbox.service.spec.ts
→ ok
apps/web tsc --noEmit → exit 0
```

`omnichannel-phase-acceptance.spec.ts` روی assert قدیمی SMS timeout شکست می‌خورد (نامرتبط با این تسک؛ assertهای route جدید قبل از آن خط اضافه شده‌اند).

## Owner ops after deploy

1. تب انتشارها / عملیات → **خالی کردن صف انتظار** (با دلیل)
2. **شمارش محصولات** برای دستهٔ انتخابی
3. **شروع ارسال دسته** (دسته‌های بزرگ‌تر از ۱۰۰ را چند بار بزنید)
4. کارت صف را تازه کنید؛ پست‌ها با فاصلهٔ قواعد خودکار می‌روند

## Rollback

Revert همین فایل‌ها. صف‌های لغوشده با requeue/category دوباره ساخته می‌شوند؛ ردیف outbox حذف نشده است.
