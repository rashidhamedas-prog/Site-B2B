# SMS.ir egress Worker (Cloudflare)

Hetzner/EU VPS often cannot complete TLS to `api.sms.ir`. This Worker proxies
allowed sms.ir REST paths from Cloudflare edge (which can reach the API).

## Deploy

```bash
cd deploy/sms-egress-worker
npm install
npx wrangler login   # or set CLOUDFLARE_API_TOKEN
# generate a long random secret (32+ chars), same value on VPS:
npx wrangler secret put EGRESS_SECRET
npx wrangler deploy
```

Note the `*.workers.dev` URL from deploy output (e.g. `https://taranom-sms-egress.<account>.workers.dev`).

## VPS `.env` (api container via env_file)

```env
SMS_EGRESS_BASE_URL=https://taranom-sms-egress.<account>.workers.dev
SMS_EGRESS_SECRET=<same-as-worker-EGRESS_SECRET>
```

Restart API after setting env. Admin → Settings → SMS → «تست اتصال».

## Security

- Requests without matching `x-taranom-egress-secret` → 401
- Only `/v1/send/bulk`, `/v1/send/verify`, `/v1/credit`, `/v1/line`
- sms.ir API key is forwarded, never stored by the Worker
