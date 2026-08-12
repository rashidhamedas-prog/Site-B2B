# Payment observability (Phase 8) — 2026-08-12

Minimal process-local metrics + structured logs for payment start/verify. No Prometheus/OTel deps.

## What shipped

| Signal | Where |
|--------|--------|
| Structured logs (`paymentId`, `orderId`, `providerCode`; mobile masked) | `PaymentService.start` / `verify` |
| Counters: `payment_start_total`, `payment_success_total`, `payment_failure_total`, `callback_duplicate_total` | `PaymentMetrics` (in-memory) |
| Admin read | `GET /v1/payments/metrics` — JWT + `ADMIN` only |

Counters reset on API process restart. Prefer log aggregation for historical trends until a durable exporter exists.

## Runbook stubs

### Provider outage (gateway timeout / 5xx)

1. Confirm `payment_failure_total` rising and API logs `event=payment.start.failed` / verify failure with `providerCode`.
2. Check provider status page + `GET /v1/payments/providers` (admin) for enablement/sandbox flags.
3. Temporary mitigation: disable online pay in admin settings for affected channel; keep COD/manual invoice path.
4. After recovery: smoke `POST /payments/start` on disposable staging; watch `payment_start_total` and success path.
5. Do **not** manually mark orders PAID without ledger/refund discipline.

### Refund

1. Admin `POST /v1/payments/refund` with unique `idempotencyKey`; duplicate key must return same refund row.
2. Confirm ledger `REFUND` entry and payment remains audit-traceable (`paymentId`).
3. Provider-channel refund remains blocked until adapter supports it — use `WALLET` / `MANUAL` only when business policy allows.
4. Escalate finance if amount mismatch vs bank settlement.

### Settlement / reconciliation

1. Export paid payments for the settlement window (admin list / DB: `payments` status=PAID + `refId`).
2. Match `refId` / authority against provider settlement file; investigate orphans (paid locally, missing at provider or vice versa).
3. Duplicate callbacks should increment `callback_duplicate_total` with **no** double `paidAmount` / postback — if money moved twice, freeze and open incident.
4. Record mismatch ticket with `paymentId` + `orderId` only (no full mobile/email in tickets).

## Residual

- No durable time-series; multi-replica counts are per-process.
- Independent Security review still required before calling Phase 8 “Done” for production readiness.
