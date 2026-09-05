# فلگ زنده Omnichannel — 2026-09-05

مالک در چت دستور داد هر دو فلگ روشن شود تا تست زندهٔ تلگرام امروز انجام شود.

## انجام شد

- `/opt/taranom/.env`: `OMNICHANNEL_CONNECTORS_ENABLED=true` و `OMNICHANNEL_AUTO_PUBLISH=true`
- پشتیبان: `.env.bak-omni-20260905T083043Z` (روی سرور، نه در گیت)
- `docker compose up -d --no-deps --force-recreate api worker worker-b`
- داخل کانتینر API و هر دو ورکر هر دو فلگ `true` است

## مشاهده

| چک | نتیجه |
|---|---|
| API `/v1/health` محلی | 200 |
| API عمومی | 200 |
| worker / worker-b | healthy |
| فروشگاه `.com` | 200 ~0.31s |
| فروشگاه `.ir` | 200 ~0.13s |
| outbox | DONE=30؛ deliver inflight=0 |
| `TELEGRAM_BOT_TOKEN` روی VPS | نیست |
| اتصال «ربات تک» | `DISABLED` / `TELEGRAM` / `RETAIL` |
| مقصد canary «خودم» | `@Taranomrashid` (فعال، canary=true) |

توکن در گیت، چت، یا ادمین نوشته نشد.

## بعد از توکن (همان روز)

- توکن فقط روی VPS با نام `TELEGRAM_BOT_TOKEN` نوشته شد. مقدار در این گزارش نیست.
- API/ورکرها recreate شدند. `getMe` = ok، ربات `TaranomRetailBot`.
- اتصال «ربات تک» شد `ACTIVE`.
- `@Taranomrashid` برای ارسال خصوصی `chat not found` بود. canary به مقصد عددی `1008770451` منتقل شد.
- یک `sendMessage` آزمایشی به همان chat = ok.
- صف محصول هنوز خالی است. دکمهٔ ادمین همچنان dry-run است.

مالک توکن را در چت گذاشت؛ اگر این گفتگو جایی اشتراک شود، بعداً از BotFather توکن را revoke کند.

## هنوز لازم برای پیام محصول

1. ساخت ربات در BotFather و گذاشتن توکن فقط در `.env` سرور با نام `TELEGRAM_BOT_TOKEN`
2. `/start` ربات از همان اکانت canary
3. جایگزینی `@Taranomrashid` با chat id عددی
4. روشن کردن اتصال (`ACTIVE`)
5. دکمهٔ «تست» در ادمین = فقط `getMe`
6. ارسال محصول: `dryRun: false`؛ دکمهٔ «ثبت پیش‌نویس» همچنان پیش‌نویس است

سقف canary: ۱۰ محصول زنده در هر کانال. کانکتور موجودی کم نمی‌کند.

## غیرهدف

- Done کردن TASK-20260826-001
- soak / Security مستقل روی SHA زنده
- بله / روبیکا / اینستاگرام
- DELETE ردیف outbox
