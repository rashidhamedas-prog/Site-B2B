# Payment Phase 6 — Internal B2B installments

**Date:** 2026-08-12  
**Task:** TASK-20260812-001  
**Branch:** `ai/TASK-20260812-001-payment-integrations`

## Scope delivered

Internal (non-BNPL) installment contracts are now source of truth for wholesale `INSTALLMENT` checkout:

- Additive migration `20260812-004-installment-credit-fields`
  - `creditConsumedIrr`, `approvedBy`, `approvedAt`, `ruleId`
  - unique index on `orderId` (one contract per order)
- `InstallmentService`: credit availability, atomic `createFromOrder` (customer row lock), equal schedules (last absorbs remainder), list/get, schedule payments, cancel + credit release, aging buckets, overdue mark, customer statement
- `InstallmentController` under `/installments` (JWT customer + ADMIN paths)
- Daily `@Cron` overdue job
- Order create wires `createFromOrder` **inside** the existing order DB transaction via `manager` (fail → full checkout rollback)
- Settings `minActiveInvoices` reads stored value (default 2)
- Portal nav **اقساط** + `/portal/dashboard/installments` listing `GET /installments/mine`

## Non-goals / blocked

- BNPL / SnappPay / guessed third-party endpoints remain blocked
- No edits to `payment.service.ts` verify/refund in this wave (parallel security follow-up)

## Validation

```bash
cd apps/api && npx tsc --noEmit
# TSC_EXIT: 0

npx ts-node --transpile-only src/modules/payment/installment.hardening.spec.ts
# installment.hardening.spec.ts: OK
# SPEC_EXIT: 0
```

`database.config.ts` already registered installment entities from Phase 6 schema; no further edit required.

## Rollback

1. Stop using INSTALLMENT checkout / hide portal nav if needed
2. `down` migration drops credit columns + unique index (contracts table from `20260812-003` retained unless also rolled back)
3. Revert OrderService create wiring

## Files

- `apps/api/src/modules/payment/entities/installment-contract.entity.ts`
- `apps/api/src/modules/payment/installment.service.ts`
- `apps/api/src/modules/payment/installment.controller.ts`
- `apps/api/src/modules/payment/installment-overdue.job.ts`
- `apps/api/src/modules/payment/installment.hardening.spec.ts`
- `apps/api/src/database/migrations/20260812-004-installment-credit-fields.ts`
- `apps/api/src/modules/payment/payment.module.ts`
- `apps/api/src/modules/order/order.service.ts`
- `apps/api/src/modules/settings/settings.service.ts`
- `apps/api/package.json`
- `apps/web/src/components/portal/PortalSidebar.tsx`
- `apps/web/src/app/portal/dashboard/installments/page.tsx`
- `docs/reports/2026-08-12-payment-phase6-installments.md`
