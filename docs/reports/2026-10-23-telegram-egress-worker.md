# 2026-10-23 — اسکلت Worker خروجی تلگرام

## چه شد

ورکر `deploy/telegram-egress-worker` مثل `deploy/sms-egress-worker` فقط اسکلت است.
درخواست‌های `/bot{token}/{method}` را به `https://api.telegram.org` می‌فرستد.

- هدر اختیاری `x-taranom-egress-secret` (همان SMS). اگر `EGRESS_SECRET` خالی باشد، هدر لازم نیست.
- `..`، درصد، `@`، و قطعهٔ اضافه رد می‌شود.
- متد، بدنه، و `Content-Type` جلو می‌رود. وضعیت و بدنهٔ بالادست برمی‌گردد.
- لاگ و متن 502 قطعهٔ `/bot…/` را حذف می‌کند.

## چه نشد

- `wrangler deploy` اجرا نشد.
- env ایران (`TELEGRAM_API_URL`) ست نشد.
- `TelegramAdapter` عوض نشد (آن تغییر PR #86 است).
- راز تولیدی داخل ریپو نیست.

## بعد از مرج

دیپلوی روی همان اکانت Cloudflare مربوط به `taranom-sms-egress`، با GO جدا.
ایران `TELEGRAM_API_URL` را برابر origin ورکر می‌گذارد، بدون پسوند `/bot…`.
تا وقتی آداپتر هدر راز را نفرستد، `EGRESS_SECRET` را خالی بگذارید.
