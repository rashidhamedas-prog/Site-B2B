# Checkout shipping address (TASK-20260912-004)

## Problem

Retail TorobPay showed “address incomplete” after the shopper filled the form. Client and CPG postal used `/\D/`, which **drops Persian digits**. Street was one short box. Wholesale checkout had no address object.

## Change

- Shared `ShippingAddressForm` on retail checkout, wholesale checkout, retail account, portal addresses.
- Province → city list, optional alley/plaque/unit composed into `street`.
- TorobPay mode: live checklist + 10-digit postal (Fa/Ar → Latin) + street length ≥ 8 after compose.
- Adapter `normalizeTorobpayPostal` uses `normalizeDigits`. Saved addresses store Latin postal.

## Evidence

Worktree `D:/proje/Site-B2B-checkout-address`:

- `npx tsx apps/web/src/lib/shipping-address.spec.mts` → `shipping-address spec ok`
- `npx tsx apps/web/src/lib/checkout-payment-ui.spec.ts` → `checkout-payment-ui spec ok`
- `npx tsx apps/api/src/modules/payment/adapters/torobpay.adapter.spec.ts` → `PASS` (1011 mapping still covered)
- `npx tsx apps/api/src/modules/auth/customer-addresses.spec.ts` → `ok` (Persian postal stored as Latin)
- `apps/web` `tsc --noEmit` exit 0
- `apps/api` `tsc --noEmit` exit 0

Not live until merge/deploy. Browser check of the new form is after deploy (needs shopper login).

## Rollback

Revert this commit. No migration. TorobPay toggle unchanged.
