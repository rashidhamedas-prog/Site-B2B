# کنسول ادمین کانال‌های انتشار + پیام UTF-8 — 2026-09-05

## علت «؟؟؟» در تلگرام

ربات خراب نبود. متن فارسی از ویندوز با PowerShell/SSH به `node -e` رفت و قبل از رسیدن به `api.telegram.org` به `?` تبدیل شد. کلمهٔ لاتین `canary` سالم ماند.

مسیر درست: متن فارسی را فقط داخل سورس UTF-8 سرور بساز، بعد با JSON UTF-8 بفرست.

یک پیام اصلاح‌شده با escape یونیکد همین روز به chat `1008770451` رسید (`ok`, `hasFa=true`).

## معماری این برش

همان مونولیت. تلگرام آداپتر است، نه بک‌اند دوم.

```
ادمین → OmnichannelService.pingCanary
         → فقط مقصد canary اتصال ACTIVE
         → TelegramAdapter.create (api.telegram.org)
```

`POST /v1/omnichannel/connections/:id/canary-ping` متن ثابت `CANARY_PING_TEXT` را می‌فرستد. توکن در بدنه نیست. محصول blast نمی‌شود. ثبت پیش‌نویس همچنان `dryRun: true` است.

## ارسال زنده یک محصول (canary)

مالک خواست قدم بعد یک محصول باشد، نه کاتالوگ.

مسیر: publication READY → outbox `publication.deliver.requested` → worker → `api.telegram.org` فقط به مقصد canary.

مشاهدهٔ زنده (VPS، بدون چاپ توکن/نام در لاگ ویندوز):

- محصول: `81020817-49f3-45e4-b860-a1be921d3e96` / slug `shomiz-linen-sara` / موجودی تکی ۲۳
- مقصد: `1008770451` (`isCanary`)
- publication `3279bde0-c98e-43f8-9268-34cdfce7feac` → PUBLISHED
- delivery `5c5c9abf-baac-48d4-88ed-bc3c44080dda` → SUCCEEDED
- outbox DONE؛ `providerMessageId=4`
- متن قالب روی سرور UTF-8 بود (`text_fa=true`، طول ۹۱)

در ادمین دکمهٔ «ارسال زنده به canary» با `dryRun: false` و confirm اضافه شد. ورکر بعد از CREATE موفق می‌تواند وضعیت را PUBLISHED کند. سقف ۱۰ محصول زنده در هر کانال سر جایش است.

## UI

تم روشن ERP. چهار زبانه: راه‌اندازی، سیاست، انتشار، عملیات. کارت آمادگی، برچسب وضعیت، فرم با label، دکمهٔ «پیام فارسی». تم تیره و فونت جدید اضافه نشد.

## غیرهدف

Done کردن TASK-20260826-001، soak/Security مستقل، بله/روبیکا/اینستاگرام، ارسال کاتالوگ.
