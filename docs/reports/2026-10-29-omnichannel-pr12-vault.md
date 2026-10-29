# Omnichannel PR-12 — Token vault + egress (BALE / RUBIKA)

Date: 2026-10-29 · Branch: `feat/omnichannel-pr12-vault-egress-bale-rubika` · GO حامد ۲۹ اکتبر ۲۰۲۶ — **PR open only** (no merge/deploy).

## Scope (re-scoped)

| In | Out |
| --- | --- |
| `provider-egress` for BALE/RUBIKA (`BALE_API_URL` / `RUBIKA_API_URL`) | `TELEGRAM_API_URL` / Worker / DNS / `TELEGRAM_MEDIA_UPLOAD_MODE` |
| Vault strict flag for BALE/RUBIKA env fallback | Moving `TELEGRAM_BOT_TOKEN` to vault |
| Scrubber `/v3/{token}/` + status `envIgnored` / `strictMessengers` | SMS, connectors enable, FORCE |

## Changes

- `provider-egress.ts` + spec: resolve bases; TELEGRAM delegates unchanged to `telegramApiBase`.
- Adapters Bale/Rubika call `resolveMessengerApiBase`; defaults remain official hosts.
- `resolveProviderToken`: when `OMNICHANNEL_VAULT_STRICT_MESSENGERS=true`, BALE/RUBIKA env-only → `null`; Telegram vault-then-env unchanged.
- Secrets status: `envIgnored` when strict + env present; `configured` false for strict env-only.
- Admin status exposes `strictMessengers`; short Telegram-deferred note in secrets UI.
- `.env.example` placeholders only (no live URLs/secrets).

## Tests

Unit specs: `provider-egress`, `omnichannel-token-vault` (strict + roundtrip), `bale.adapter` / `rubika.adapter` base override + redaction.

## Rollback

Unset `BALE_API_URL` / `RUBIKA_API_URL`; set `OMNICHANNEL_VAULT_STRICT_MESSENGERS=false`. Telegram path never changed.
