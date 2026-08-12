# Runbook — Refund

## Rules
- Only ADMIN `POST /v1/payments/refund` with `idempotencyKey`
- Cumulative SUCCEEDED refunds cannot exceed payment amount
- Provider gateway refund path is fail-closed until approved adapter exists
- Wallet/MANUAL channels only for current production

## Steps
1. Confirm payment status PAID and original amount
2. Choose amount ≤ remaining refundable
3. Call refund with unique idempotency key; retry same key is safe
4. Reconcile ledger entry type REFUND (negative amount)
5. If installment contract exists, allocate against schedules via admin installment payment APIs — do not edit notes as SoT
