# 2026-09-28 — sms.ir EU-VPS egress

## Root cause

Production DB SMS settings were healthy (`enabled`, API key length 48, line `9982007567`).
API logs showed `sms.ir /send/bulk … aborted due to timeout`. From `taranom_api`, TLS to
`api.sms.ir` hangs; from non-Hetzner networks the same host responds (e.g. HTTP 401 without key).

## Fix

- Shared transport with optional `SMS_EGRESS_BASE_URL` + `SMS_EGRESS_SECRET`
- Cloudflare Worker under `deploy/sms-egress-worker`
- Admin «تست اتصال» → `POST /v1/notifications/sms/probe`
- Specs: `sms-transport.spec.ts` OK

## Ops

1. Deploy Worker (`npx wrangler deploy` + `secret put EGRESS_SECRET`)
2. Set VPS `.env` `SMS_EGRESS_*` and restart api
3. Probe from admin SMS tab
