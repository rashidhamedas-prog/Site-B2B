# 2026-10-28 — Omnichannel PR-4: no auto-revive / HOLD on unknown

**شاخه:** `feat/omnichannel-pr4-hold` (از `origin/master` = `0c8a7d3a`، PR-3 روی ایران) · **Merge/Deploy:** فقط با GO نوشتاری حامد · برنامه: `docs/design/omnichannel-redesign/pr4-hold-plan.md`

نیمهٔ HOLD قبلاً در کد بود (PROCESSING هنگام reclaim → HOLD `uncertain_after_timeout`، timeout → HOLD، stale → HOLD). این PR دو شکاف را می‌بندد.

## تغییرات

| # | تغییر | فایل |
| --- | --- | --- |
| 1 | revive ردیف‌های DEAD «connector is disabled» حالا **یکی در هر فراخوانی** (قدیمی‌ترین)، صرف‌نظر از `limit` کلاینت. قبلاً تا ۵۰۰ (UI: ۲۰۰) | `delivery-hold-policy.ts`, `omnichannel.service.ts`, `outbox.service.ts` |
| 2 | پرچم بازگشت `OMNICHANNEL_BULK_REVIVE_ENABLED=true` رفتار قبلی را برمی‌گرداند (پیش‌فرض خاموش) | همان |
| 3 | پاسخ و audit فیلد `limitApplied` / `bulk` دارند | `omnichannel.service.ts` |
| 4 | `isUnconfirmedSendError`: reset اتصال، socket hang up، EPIPE، Bad Gateway / Gateway Time-out → HOLD به‌جای RETRY (ممکن است پست رسیده باشد). `ECONNREFUSED`/DNS دست‌نخورده (چیزی ارسال نشده) | `publication-deliver.ts` |
| 5 | UI: `limit: 1`، متن دکمه «بازتلاش یک مورد» | `AdminOmnichannel.tsx` |

## تست

- جدید: `delivery-hold-policy.spec.ts`؛ گسترش: `delivery-claim.spec.ts` (revive واقعی با query builder جعلی)، `outbox.service.spec.ts`، `publication-deliver.spec.ts`، `admin-omnichannel-connector-disabled.spec.ts`.
- اجرا شده: این پنج + `omnichannel-phase-acceptance.spec.ts` + `delivery-reactivate-conflict.spec.ts` سبز؛ `tsc` api بدون خطای omnichannel.

## ریسک و بازگشت

- رفتار عملیاتی: اگر ده‌ها DEAD «connector disabled» مانده باشد، باید یکی‌یکی (با دلیل) revive شوند. عمدی است؛ برای یک نوبت دسته‌ای: env `OMNICHANNEL_BULK_REVIVE_ENABLED=true` + restart api، بعد حذف.
- HOLD بیشتر: خطاهای reset/502/504 روی CREATE حالا منتظر تأیید مجدد Owner می‌مانند، نه retry خودکار. بازگشت: `git revert`.
- بدون migration، بدون تغییر env الزامی، بدون تماس شبکه‌ای. آیدی مقصد یا flag کانکتور تغییر نکرد.

## باز / بعدی

- timeout روی UPDATE/DELETE: delivery در `RETRY` بدون event زنده می‌ماند (ارث‌برده، دست‌نخورده)؛ نیاز به تصمیم.
- ستون‌های `attempt_started`/`lease_until` نیاز migration دارند → همراه PR-5.
- `requeueByCategory` (انتشار گروهی) پشت سوئیچ Owner → PR-6.
