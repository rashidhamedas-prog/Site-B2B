# Sales Partner program — progress 2026-09-22

Task: `TASK-20260922-003`  
Branch: `feat/TASK-20260922-003-sales-partner-program`

Isolated marketer program. Vendor `/partners` and external `affiliateId` were not reused.

## Live

LIVE on production 2026-09-23. Terms `2026-09-23-v1`. Dedicated IBAN key on API host. Hold 14 days.

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
- Live API `/v1/sales-partner-program/public-settings` → 200 `{enabled:true, applyOpen:true, termsVersion:"2026-09-23-v1", termsFinal:true}` (re-verified 2026-09-26)

## Independent review

- Reviewer: [Sales partner independent review](6f63b59f-c25e-4127-9b53-8311f884f48d) — flag-OFF merge OK; D1–D3 were LIVE blockers
- Security: [Security Review](086a7a9b-4f08-4f0c-99b6-da68a4f61141) — no critical/high; IBAN XOR fixed to AES-GCM

## Not done (updated 2026-09-26)

- **Owner OPS:** set PROGRAM commission rule %, enable catalog product eligibility, optional `minPayoutIrr` floor
- **Independent money/attribution review** still open (post-LIVE)
- Browser E2E full apply→approve→draft→confirm walk not recorded
- Cookie attribution (`taranom_sp`) is client-readable; server re-validates ACTIVE+eligibility

## Done since earlier draft of this section

- LIVE enable + terms `2026-09-23-v1` + hold 14d
- Public settings API returning enabled subset
- Dedicated `SALES_PARTNER_IBAN_KEY` present on API host
- Attribution migrations applied; product share `/go/sp` live (invalid → 302, no cookie)
