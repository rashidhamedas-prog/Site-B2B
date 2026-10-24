# Telegram egress (Bot API via Cloudflare)

## Problem

The Iran-hosted API needs `https://api.telegram.org` and often cannot complete that call.
The EU SMS path already uses a Cloudflare Worker for the same reason (`api.sms.ir`).

## Solution

```
Nest API (Iran)  →  TELEGRAM_API_URL (this Worker base, no /bot…)  →  https://api.telegram.org
```

- Worker: [`deploy/telegram-egress-worker/`](../../deploy/telegram-egress-worker/)
- Twin: [`docs/architecture/sms-egress.md`](sms-egress.md) and [`deploy/sms-egress-worker/`](../../deploy/sms-egress-worker/)
- Iran sets `TELEGRAM_API_URL` to the Worker origin only, for example `https://taranom-telegram-egress.<account>.workers.dev`. No `/bot{token}/{method}` on that value. The adapter appends `/bot{token}/{method}` (PR #86). This scaffold does not change `TelegramAdapter`.
- Optional shared secret, same header as SMS egress: Worker `EGRESS_SECRET` and request header `x-taranom-egress-secret`. Unset secret does not reject. When the secret is set, a mismatch is 401. The current adapter does not send the header.
- `TELEGRAM_MEDIA_UPLOAD_MODE=upload` makes the adapter POST `multipart/form-data` (`sendPhoto` / `sendMediaGroup`) through this same base. The Worker forwards that Content-Type, including the boundary, and reads the body with a 32 MB cap. A larger body is 413 and is not sent upstream. Upstream fetch aborts after 26s. Default mode is `url` (JSON image URLs) until the flag is set and api plus the omnichannel worker are restarted.

## Invariants

- Upstream host is fixed: `https://api.telegram.org`.
- Only `/bot{token}/{method}`. `..`, percent-encoding, `@`, and extra segments are rejected.
- Logs redact `/bot…/` token segments.
- Deploy and the Iran env change are a separate GO, on the same Cloudflare account as `taranom-sms-egress`. This document does not perform either.
