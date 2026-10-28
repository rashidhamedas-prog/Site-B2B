# 2026-10-28 — Omnichannel hotfix pre-PR3

**تاریخ:** ۲۰۲۶-۱۰-۲۸ · **شاخه:** `fix/omnichannel-hotfix-pre-pr3` · **GO deploy:** منتظر تأیید حامد (بدون FORCE)

## Diagnosis

- پس از دیپلویهای اخیر omnichannel، مسیر **create-send با رزرو outbox** روی HOLD/DEAD با خطای Postgres **`42P08`** (inconsistent types deduced for parameter `$2`) می‌افتاد؛ ارسال واقعی یا رزرو بلاک می‌شد.
- در `/admin/omnichannel` کارت health ورکر **heartbeat کهنه** یا «نامشخص» نشان می‌داد با وجود worker سالم — mismatch بین api و worker در خواندن فایل heartbeat.
- PR-1/PR-2/PR-3 و SMS #115 **عمداً** جلو نمی‌روند تا این بسته سبز و روی ایران deploy شود.

## Root cause

1. **SQL dual-bind بدون cast:** در `reserveCreateSend` (و HOLD مرتبط) پارامتر `$2` هم به ستون enum/`deferredReason` و هم به `lastError` (text) bind می‌شد. Postgres نوع `$2` را یکدست استنتاج نمی‌کند → **42P08**. منطق با commit حدود **`cf32e8dd3`** (create-send reserve SQL) وارد کدbase شد و پس از imageهای omnichannel روی production فعال شد.
2. **IPC جدا در کانتینرها:** api (read-only health) و worker هر کدام filesystem `/tmp` خودشان را داشتند؛ worker در `/tmp/...heartbeat` می‌نوشت، api همان مسیر را در کانتینر دیگر می‌خواند → **فایل stale یا غایب** در UI.

## Fix

| لایه | تغییر |
| --- | --- |
| SQL | cast صریح (`::text` و موارد لازم) برای bindهای مشترک؛ استخراج به `apps/api/src/modules/omnichannel/services/reserve-create-send-sql.ts` |
| Compose | volume نام‌دار `omnichannel_ipc` mount در `/ipc` روی api + worker (+ web healthcheck)؛ env: `OMNICHANNEL_WORKER_HEARTBEAT`, `DRAIN`, `DRAINED` زیر `/ipc/...` |
| Deploy | `scripts/auto-deploy.sh`: قبل از recreate، مسیر drain/drained از **env کانتینر worker در حال اجرا** (`docker exec printenv`)؛ fallback `/tmp/...` برای image قدیمی |

**محدودیت‌های حامد (ثابت):** بدون `TARANOM_DEPLOY_FORCE` / FORCE؛ بدون mass retry outbox؛ **PR-3 merge ممنوع** تا validation سبز؛ **SMS PR #115 merge ممنوع**؛ canary **Bale** فقط بعد از deploy موفق این hotfix.

## Validation plan

1. **Unit:** از `apps/api`: `npx ts-node --transpile-only src/modules/omnichannel/services/reserve-create-send-sql.spec.ts` (regression 42P08).
2. **Health IPC:** بعد از `docker compose up` محلی، worker beat → api `GET /v1/omnichannel/health` باید `workerHeartbeatAt` تازه (<۲ دقیقه) نشان دهد؛ بنر mismatch فقط وقتی env عمداً diverge شود.
3. **Deploy gate:** `node --test scripts/deploy-gate.spec.mjs` — drain wait بدون SIGKILL.
4. **Post-deploy ایران (با GO):** `/v1/health`؛ refresh `/admin/omnichannel` — heartbeat سبز؛ یک create-send تست **غیر-canary** یا dry-run مجاز؛ سپس canary Bale طبق runbook.
5. **Outbox:** نمونه‌گیری وضعیت PENDING/HOLD/DEAD قبل و بعد — بدون job mass-retry.

## Queue left for Hamed

| مورد | مقدار |
| --- | --- |
| Outbox PENDING (قبل deploy) | **UNKNOWN** |
| Outbox HOLD/DEAD مرتبط 42P08 | **UNKNOWN** |
| Outbox PENDING (بعد deploy + N دقیقه) | **UNKNOWN** |
| تصمیم mass-retry | **ممنوع** (explicit) |
| GO deploy + `deploy-approval.json` commit | **UNKNOWN** |
| زمان canary Bale | **بعد deploy** |

## Rollback

- **کد:** revert شاخه/PR hotfix؛ image قبلی api/worker/web.
- **Compose volume:** حذف volume اختیاری است؛ بدون migration DB. اگر rollback به image بدون `/ipc`، env دوباره `/tmp` — health mismatch ممکن است برگردد (قبل از hotfix).
- **Ops:** drain flag را دستی پاک نکن مگر runbook؛ deploy بعد از rollback همان گیت approval را می‌خواهد.
