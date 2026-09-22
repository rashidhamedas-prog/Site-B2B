# Sales Partner program — progress 2026-09-22

Task: `TASK-20260922-003`  
Branch: `feat/TASK-20260922-003-sales-partner-program`

Isolated marketer program. Vendor `/partners` and external `affiliateId` were not reused.

## Live

Not live. Feature flag default OFF.

## Coded

- Apply / OTP / admin review / `purpose=sales_partner`
- Catalog eligibility + commission rules + vendor SKU margin guard
- Draft → SMS hashed token → customer confirm → `RETAIL_WEBSITE` via `OrderService.create`
- Ledger job: paid → held, cancel/refund/return → reversal
- Partner panel: home totals, catalog, new order with variant + resend countdown, orders, commissions, payouts, IBAN profile
- Admin: applications, partners, catalog, rules, payout confirm with idempotency

## Observed gates

- sales-partner policy/commission/draft/ledger/settings/catalog-policy specs OK
- staff-access.spec OK
- `apps/api` and `apps/web` `tsc --noEmit` 0

## Not done

- Independent Reviewer + Security
- E2E / browser / a11y pass
- Partial RMA line reversal
- Order-table attribution columns (entity claimed elsewhere)
- Legal terms (placeholder `draft-unreviewed`)
- Push/deploy
