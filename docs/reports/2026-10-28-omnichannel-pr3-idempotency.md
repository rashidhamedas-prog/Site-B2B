# 2026-10-28 — Omnichannel PR-3 Idempotency (delta)

**شاخه:** `feat/omnichannel-pr3-idempotency` (پایه `ed19489a`، بعد از #119) · **Merge/Deploy:** منتظر GO نوشتاری حامد + بکاپ دیتابیس (owner)

بیشتر idempotency ساخت (CREATE) از ۲۰۲۶-۱۰-۲۵ روی لایو است (`20261025-001`). این PR فقط **شکاف‌ها** را می‌بندد. برنامه: `docs/design/omnichannel-redesign/pr3-idempotency-plan.md`.

## تغییرات

| # | تغییر | فایل |
| --- | --- | --- |
| 1 | کلید DELETE بدون content hash: `DELETE:{dest}:{msgId}:` (UPDATE همچنان با hash) | `delivery-idempotency.ts` |
| 2 | Migration افزایشی: unique جزئی برای UPDATE/DELETE فعال (`PENDING/PROCESSING/RETRY/HOLD`، `supersededAt IS NULL`؛ SUCCEEDED عمداً بیرون). بازنده‌ها DEAD + `supersededAt` (بدون `DELETE FROM`)، snapshot در `omnichannel_delivery_dedupe_undo`، نرمال‌سازی کلید DELETE فعال با جدول undo جدا | `20261028-001-omnichannel-mutation-idempotency.ts` |
| 3 | `@Index` روی entity | `publication-delivery.entity.ts` |
| 4 | ثابت‌ها و SQL پیش‌اجرا (dry-run) | `delivery-dedupe-sql.ts` |
| 5 | `reserveCreateSend`: بازخوانی ردیف زیر `FOR UPDATE` داخل tx؛ PROCESSING تازه = worker هم‌زمان، نه HOLD | `reserve-create-send-sql.ts`, `omnichannel.service.ts` |
| 6 | `reactivateDelivery`: خطای `23505` → نتیجه superseded + audit (`conflict: active_slot_taken`)، بدون throw | `omnichannel.service.ts` |
| 7 | INSERT در `enqueueOneDelivery` برای UPDATE/DELETE از predicate همان index استفاده می‌کند (قبلاً فقط CREATE)؛ outbox بازنده `mutation_deduped` | `omnichannel.service.ts` |

انتخاب نگهدارنده در migration: ردیف **PROCESSING** اول (در حال ارسال)، وگرنه **جدیدترین** (ویرایش ارسال‌نشده‌ی قدیمی کهنه است). از plan یک اختلاف کوچک: plan فقط «جدیدترین» گفته بود.

## تست

- Unit (در `scripts/unit-specs.txt`): `delivery-idempotency.spec.ts` (کلید DELETE/UPDATE/CREATE، اسکن بدون time/random)، `20261028-001-omnichannel-mutation-idempotency.spec.ts`، `delivery-claim.spec.ts` (service واقعی با mutex: دو worker → یک send؛ PROCESSING بعد از restart → HOLD، بدون claim)، `delivery-reactivate-conflict.spec.ts`، `reserve-create-send-sql.spec.ts`.
- Integration (`delivery-idempotency.integration.spec.ts`): با `DATABASE_URL` یک دیتابیس **آزمایشی** (در schema موقت؛ نام prod و هاست ایران رد می‌شود)؛ بدون آن skip. محتوا: migration up/down/up روی داده seed، unique جزئی، درج هم‌زمان، race واقعی `reserveCreateSend`، restart.
- `PR3_TEST_PGLITE_MODULE` حالت تک‌اتصال (بدون race دو-اتصالی) برای اعتبارسنجی SQL.

## Pre-flight روی ایران (read-only، قبل از اجرای migration)

اجرا نشده (بدون دسترسی/GO). مالک `MUTATION_DRY_RUN_REPORT_SQL` را از `delivery-dedupe-sql.ts` اجرا کند و تعداد را ثبت کند؛ انتظار ۰ تا چند ردیف. اگر > ۰: فهرست مقصد/پیام برای حامد.

## بکاپ (گیت سخت)

Owner یک dump تازه و لیست‌شدنی `scripts/backup-postgres.sh` روی ایران، **بعد از deploy #119 و درست قبل از migration** بگیرد و نام (`YYYYMMDDTHHMMSSZ`) اینجا ثبت شود: `__ثبت نشده__`. Deploy فقط با GO + `deploy-approval.json` همان commit، بعد از drain.

## Rollback

کد: revert PR. DB: `down()` همین migration (فقط index جدید را حذف و بازنده‌ها/کلیدهای DELETE را از undo برمی‌گرداند؛ CREATE index، ستون‌ها و undo اصلی دست‌نخورده). آخرین راه: restore dump.

## ریسک‌ها / خارج از این PR

- **D-2** (CREATE دوباره بعد از DELETE ادمین: `dedupeKey` outbox قبلی ممکن است `deduped` برگرداند و `0` بدهد) **بازتولید/اصلاح نشد**؛ تصمیم برنامه: PR-7 یا test مستند. 
- race دو-اتصالی واقعی روی Postgres سرور در این محیط اجرا نشد (initdb محلی crash کرد)؛ فقط pglite + unit. قبل از merge در CI/لوکال با `DATABASE_URL` اجرا شود.
- کلید outbox برای DELETE بدون hash: دومین DELETE همان پیام (حتی بعد از DEAD) را `dedupeKey` outbox می‌گیرد؛ retry عمدی از مسیر reactivate است.
- بدون connector enable، بدون egress تلگرام، بدون تغییر worker/adapter/apps/web.
