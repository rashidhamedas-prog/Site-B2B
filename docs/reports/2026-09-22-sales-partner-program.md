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
- Ledger job: paid → held; unpaid cancel writes no reversal; approved RMA reverses that item only
- Snapshot uses allocated promo discount; wallet is excluded
- Partner panel: home totals, catalog, new order with variant + resend countdown, orders, commissions, payouts, IBAN profile
- After convert, partner/admin status labels follow retail order FSM; delivered overlays hold/available commission
- Open drafts warn on price/stock drift; new-order form keeps a device-local draft until SMS is sent
- Admin: applications, partners, catalog, rules, payout confirm with idempotency
- IBAN AES-256-GCM; prefer `SALES_PARTNER_IBAN_KEY`

## Observed gates

- sales-partner policy/commission/draft/ledger/settings/catalog-policy/iban/isolation specs OK
- staff-access.spec OK
- PREVIEW cannot create drafts; OFF ignores `enabled=true`
- `apps/api` and `apps/web` `tsc --noEmit` 0 after admin settings/orders/outbox
- Live API `/v1/sales-partner-program/public-settings` is 404 until this branch deploys (expected; flag remains OFF)

## Independent review

- Reviewer: [Sales partner independent review](6f63b59f-c25e-4127-9b53-8311f884f48d) — flag-OFF merge OK; D1–D3 were LIVE blockers
- Security: [Security Review](086a7a9b-4f08-4f0c-99b6-da68a4f61141) — no critical/high; IBAN XOR fixed to AES-GCM

## Not done

- Browser E2E against a running storefront (static RTL/focus/label checks are in isolation spec)
- Dedicated production `SALES_PARTNER_IBAN_KEY` must be set before LIVE IBAN save
- Order attribution columns coded; migrate `20260923-001` before convert in LIVE
- Legal terms (placeholder `draft-unreviewed`)
- Push/deploy / LIVE enable
