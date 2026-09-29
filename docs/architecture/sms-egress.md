# SMS egress (sms.ir from EU VPS)

## Problem

Origin API on Hetzner (Germany) often cannot complete TLS to `https://api.sms.ir`.
TCP connects; handshake hangs. Retail and wholesale share one `NotificationService`,
so both OTP and transactional SMS fail together.

## Solution

```
Nest API  →  SMS_EGRESS_BASE_URL (Cloudflare Worker)  →  api.sms.ir
```

- Transport: [`apps/api/src/modules/notification/sms-transport.ts`](../../apps/api/src/modules/notification/sms-transport.ts)
- Worker: [`deploy/sms-egress-worker/`](../../deploy/sms-egress-worker/)
- Env: `SMS_EGRESS_BASE_URL`, `SMS_EGRESS_SECRET` (api `env_file`)
- Admin probe: `POST /v1/notifications/sms/probe`

## Invariants

- Provider remains **sms.ir** only (admin API key + line).
- Egress secret never returned in admin settings JSON.
- Allowed Worker paths: `/v1/send/bulk`, `/v1/send/verify`, `/v1/credit`, `/v1/line`.
- Empty egress → direct `api.sms.ir` (for Iran-hosted origins).
