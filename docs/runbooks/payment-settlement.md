# Runbook — Settlement / reconciliation

## Daily
1. Compare gateway settlement export (manual download) with `payments` where status=PAID for the day
2. Check `payment_ledger_entries` CAPTURE sum vs PAID payments
3. Investigate `settlement_mismatch` / unpaid invoices with PAID payments

## Installments
- Admin `GET /v1/installments/aging` for overdue buckets
- Overdue job marks PENDING past `dueAt` → OVERDUE
- Cancelled orders must release credit (`cancelByOrderId` on reverseEffects)

## Do not
- Enable BNPL without APPROVED contract + official docs
- Mutate production passwords via E2E scripts
