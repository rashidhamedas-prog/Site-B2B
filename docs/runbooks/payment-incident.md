# Runbook — Payment incident

## Symptoms
- Spike in `payment_failure_total` / failed starts
- Checkout cannot reach ZarinPal
- Orders stuck PENDING while customer paid at gateway

## Immediate
1. Check API health: `GET https://api.poshaktaranom.com/v1/health`
2. Admin: `GET /v1/payments/metrics` and `GET /v1/payments/summary`
3. Confirm merchant/sandbox settings in admin payment settings (no secrets in chat/logs)
4. Kill-switch: disable ONLINE in settings or set provider `maintenanceMode` / `enabled=false` via admin providers API

## Triage
- Correlate `paymentId` / `orderId` from structured logs (mobile masked)
- If paid-at-gateway but local CANCELLED: ask customer to open callback with Status=OK (soft-cancel recovery) or re-verify with matching authority
- Do not invent BNPL workarounds

## Escalate
- Owner + on-call; capture correlation IDs; avoid production DB password mutation
