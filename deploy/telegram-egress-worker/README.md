# Telegram Bot API egress Worker (Cloudflare)

Iran-hosted API often cannot reach `api.telegram.org`. This Worker proxies
`/bot{token}/{method}` from the Cloudflare edge (which can reach the Bot API).

Twin of [`deploy/sms-egress-worker`](../sms-egress-worker/). Architecture:
[`docs/architecture/telegram-egress.md`](../../docs/architecture/telegram-egress.md).

This directory is a scaffold. Do not `wrangler deploy` from a pull request.
Deploy needs a separate GO on the **same Cloudflare account as `taranom-sms-egress`**.

## Deploy (only after that GO)

```bash
cd deploy/telegram-egress-worker
npm install
npx wrangler login   # or set CLOUDFLARE_API_TOKEN — same account as sms-egress
# Optional until the API sends the header. When set, it must match the caller.
# npx wrangler secret put EGRESS_SECRET
npx wrangler deploy
```

Note the `*.workers.dev` URL (for example `https://taranom-telegram-egress.<account>.workers.dev`).

## Iran env (separate GO — not this scaffold)

`TELEGRAM_API_URL` is the Worker **origin only**. No `/bot…` suffix.
`TelegramAdapter` appends `/bot{token}/{method}` (that env wiring is PR #86, not this Worker).

```env
TELEGRAM_API_URL=https://taranom-telegram-egress.<account>.workers.dev
```

Restart API and workers after the env change. Unset `TELEGRAM_API_URL` to go back to `https://api.telegram.org`.

`TelegramAdapter` does **not** send `x-taranom-egress-secret` yet. Leave `EGRESS_SECRET` unset until a later change adds that header. If the secret is set early, every Bot API call returns 401.

## Multipart photo uploads

`TELEGRAM_MEDIA_UPLOAD_MODE` defaults to `url` (JSON, image URL in `photo` / `media`). Set it to `upload` only after this Worker revision is deployed. The API then reads each product image from MinIO (or same-origin HTTPS) and POSTs `multipart/form-data` to `{TELEGRAM_API_URL}/bot{token}/sendPhoto|sendMediaGroup`.

This Worker:

- Forwards `Content-Type` unchanged, including the multipart boundary
- Stream-reads the body and forwards it only when the complete buffer is at most 32 MB
- Returns 413 `body too large` without calling Telegram when the cap is exceeded (it does not proxy a truncated body)
- Aborts the upstream `fetch` after 26 seconds

Rollback of the flag is an env change on the API and the omnichannel worker (`url` or unset, then restart). The Worker can stay deployed. Do not `wrangler deploy` from a pull request.

## Security

- `EGRESS_SECRET` unset → header not required (open proxy; do not publish the URL until you accept that, or set the secret together with the API header)
- `EGRESS_SECRET` set → missing or wrong `x-taranom-egress-secret` returns 401 (timing-safe compare, same header as SMS egress)
- Only `/bot{token}/{method}`. `..`, `%`, `@`, extra segments, and `/file/bot…` are rejected
- Method, body, and `Content-Type` are forwarded. Upstream status and body are returned. Redirects are not followed
- Logs and 502 text redact `/bot…/` token segments. The bot token is not stored
