# Sales Partner program — Phase 0–1

Task: TASK-20260922-003  
Branch: `feat/TASK-20260922-003-sales-partner-program`

## Done in this slice

- Architecture: `docs/architecture/sales-partner-program.md`
- Isolated module `apps/api/src/modules/sales-partner/`
- JWT `purpose=sales_partner` cannot use vendor/admin/shopper tokens
- Apply + OTP + admin review; feature flag default OFF
- Admin `/admin/partners` label is now «تأمین‌کننده ارسال»

## Not live

Program settings default `mode=OFF`. No production migrate/deploy in this note until later phases and independent review.

## Deferred

Draft conversion, catalog eligibility UI, ledger jobs, payout batches, E2E, independent Reviewer/Security.
