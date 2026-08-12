# Payment Phases 1–3 implementation report

**Date:** 2026-08-12  
**Task:** TASK-20260812-001  
**Branch:** ai/TASK-20260812-001-payment-integrations

## Delivered

### Phase 1 — P0 payment core
- Race-safe `verify` with pessimistic lock + CAS PENDING/FAILED→PAID
- Ledger entry + order confirm + invoice paidAmount in same transaction
- Postback once-flag via `payments.postbackFiredAt` CAS
- ZarinPal adapter with AbortController timeout + safe retries
- Public allowlisted DTO (no meta)
- Payment attempts on start/retry; failed start recoverable
- Manual payment: finite positive, overpay guard, ledger, actor
- RefundEntity + idempotent wallet refund path
- Order idempotency: scope + payload hash + ownership + 409
- Invoice recordPayment transactional
- Affiliate once-guard
- Migration `20260812-001-payment-core-hardening`
- Spec: `payment-core.hardening.spec.ts`

### Phase 2 — provider-agnostic registry
- `payment_providers` table + seed (ZarinPal APPROVED; BNPL NOT_STARTED disabled)
- Migration `20260812-002-payment-providers-registry`

### Phase 3 — admin/registry API
- `GET /payments/providers/eligible` (server-authoritative)
- `GET/POST /payments/providers` admin (no secrets)

### Phase 4–5
- Disabled adapters + BNPL assessment doc; **no fake endpoints**

### Phase 6 (schema)
- `installment_contracts` + `installment_schedules` migration `20260812-003`

## Gates (local)
- `tsc --noEmit` apps/api: pending re-run after registry
- payment-core.hardening.spec: OK

## Deploy
Pending commit → PR → merge → VPS auto-deploy + migration run + health.
