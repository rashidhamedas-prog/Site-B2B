# Sales Partner Program — Architecture

Status: implementation-ready  
Task: `TASK-20260922-003`  
Branch: `feat/TASK-20260922-003-sales-partner-program`  
Date: 2026-09-22  
Channel: retail storefront only (`.ir`)

This document is the source of truth for implementation. Do not invent legal copy, tax rates, or payout bank details. Do not reuse Vendor, `/partners`, or external `affiliateId`.

---

## 1. Confirmed facts

| Fact | Evidence |
|------|----------|
| Existing `/partners` and `/admin/partners` are **dropship fulfillment vendors** (`VendorEntity`, JWT `purpose=vendor`, `FulfillmentOrder`, `VendorLedgerEntryEntity`). Net payable = goods − Taranom cut after parcel `DELIVERED` + hold. | `apps/api/src/modules/vendor/*`, `docs/architecture/admin-partners.md` |
| Admin UI currently labels vendors «همکاران فروش». Product form says «همکار تأمین». | `AdminSidebar.tsx`, `AdminPartners.tsx` |
| `affiliate` + `orders.affiliateId` are **external CPA postbacks** (Yektanet/Torob/etc.), not internal agents. | `apps/api/src/modules/affiliate/*` |
| `users.phone` is unique; `users.role` is a single string. | `user.entity.ts` |
| JWT purposes today: `admin`, `retail`, `wholesale`, `vendor`. Unknown purpose falls through to `wholesale`. | `staff-access.ts` `resolveAuthPurpose` |
| Vendor users cannot shop or use other purposes. Staff can shop via `purpose=retail\|wholesale` while keeping DB role. | `jwt.strategy.ts`, `auth.service.ts` |
| Retail orders persist as `type=RETAIL_WEBSITE`. There is no `RETAIL_PARTNER`. | `packages/shared-types/src/enums.ts` |
| Create-order checks stock but commits on payment/confirm. ONLINE unpaid is `AWAITING_PAYMENT`. | `order.service.ts` |
| Wallet reduces payable total; stored on `walletApplied`. Treat as payment, not merchandise discount. | `order.entity.ts` |
| COD is server-gated by `retailCashEnabled` (default off). | `settings-payment-cash.ts` |
| Customer RMA has **no enforced return-window setting**. Vendor hold is per-vendor days after parcel deliver. | `rma.service.ts`, `vendor-ledger-policy.ts` |
| Outbox: `OutboxService.enqueue` with `ON CONFLICT DO NOTHING`. | `outbox.service.ts` |
| Money is integer IRR. Vendor commission uses `Math.floor`. | `fulfillment-split-policy.ts` |
| No `SalesPartner` type, table, purpose, or `/sales-partners` route exists. | repo grep 2026-09-22 |

## 2. Assumptions (low-risk, recorded)

1. Public apply is **retail-only**. Wholesale buyers are not sales partners in MVP.
2. Legal terms copy is a **placeholder** until owner/counsel approve. Account cannot become `ACTIVE` without `termsAcceptedAt`.
3. IBAN (شبا) is stored; full card numbers are never stored. IBAN is masked in UI/logs (`IR**…1234`).
4. Iran display timezone is `Asia/Tehran`; storage is UTC `timestamptz`.
5. UI amounts show تومان with an explicit «تومان» label; calculations stay IRR integers.
6. Default program mode is `OFF`. Production behavior does not change until an admin turns the flag on.
7. Attribution links/codes are **Phase 8+**. MVP is manual draft + customer confirmation.

## 3. Decisions requiring confirmation

| ID | Question | Safe default until confirmed |
|----|----------|------------------------------|
| D1 | Exact hold days after delivery | Setting `commissionHoldDays` required and `> 0` before auto-release; no auto-settle if unset |
| D2 | Self-referral (partner phone == customer phone) | Blocked |
| D3 | Legal terms text | Placeholder + `termsVersion`; counsel must replace |
| D4 | Fixed-amount commission | Not in MVP; percent only |
| D5 | Minimum payout | Setting `minPayoutIrr`; default 0 until owner sets |
| D6 | Who may change attribution after convert | `ADMIN` only + reason + audit |
| D7 | Can a `VENDOR` also be a SalesPartner? | No |
| D8 | Can staff be a SalesPartner on the same phone? | No |

## 4. Goals, non-goals, success

**Outcome:** A social seller can show approved Taranom products, send a customer a confirmation link, and earn a held-then-available commission after delivery + hold — without holding stock, taking payment, or seeing another customer’s history.

**Non-goals**

- Do not replace or extend Vendor dropship.
- Do not turn external affiliate postbacks into an internal wallet.
- Do not introduce `OrderType.RETAIL_PARTNER`.
- Do not let partners set prices, mark paid, add tracking, or confirm delivery.
- Do not build a page builder, marketplace, or multi-tenant partner store.
- Do not invent guaranteed income copy.

**Success signals (reportable, not invented baselines)**

- Application → approval rate
- Draft → customer confirm → paid → delivered
- Held / available / paid / reversed commission IRR
- SMS failure count
- Suspicious-pattern flags (not the score formula)

## 5. Isolation from Vendor and affiliate

| Concern | Vendor / `/partners` | External affiliate | SalesPartner |
|---------|----------------------|--------------------|--------------|
| Name | تأمین‌کننده ارسال | شبکه تبلیغاتی | همکار بازاریاب |
| JWT purpose | `vendor` | none | `sales_partner` |
| DB role | `VENDOR` | n/a | stays `CUSTOMER` (or existing shopper) |
| Tables | `vendors`, `vendor_ledger_entries` | `orders.affiliateId` | `sales_partner_*` |
| Routes | `/partners`, `/admin/partners` | pixels/postback | `/sales-partnership`, `/sales-partners`, `/admin/sales-partners` |
| Money | net goods to shipper | CPA postback | % of eligible net merchandise |
| Trigger | parcel `DELIVERED` | payment `paid` | paid → held → available after hold |

**Hard rules**

- Do not read or write `VendorLedgerEntryEntity`.
- Do not put `salesPartnerId` into `affiliateId`.
- Partner-created orders set `salesSource=SALES_PARTNER` and **omit** `affiliateId` so no double commission.
- If a browser also has an external click id, **SalesPartner source wins** and postback is skipped. Test this.
- Vendor/dropship SKUs are ineligible unless an admin opts them in and margin guard passes.

Admin label change (disambiguation only, Vendor semantics unchanged):

- `/admin/partners` title → «تأمین‌کننده ارسال»
- `/admin/sales-partners` title → «همکار بازاریاب»

## 6. Audiences and journeys

### Public applicant

1. Opens `/sales-partnership` on retail.
2. Reads what the role is (introduce, not fulfill).
3. Submits name + phone + optional social handles.
4. Confirms phone with OTP.
5. Sees `PENDING_REVIEW` and human next step.

### Sales partner (mobile-first)

1. OTP or password login → JWT `purpose=sales_partner`.
2. Sees sellable catalog, estimated commission, inventory band.
3. Builds a draft, sends SMS confirmation.
4. Tracks human statuses; never enters tracking codes.
5. Sees held / available / paid / reversed separately.
6. Updates payout IBAN (masked).

### End customer

1. Receives SMS: partner prepared a basket; nothing is charged until they confirm.
2. Opens one-time link; sees items, Taranom as seller, shipping, totals.
3. Confirms or rejects. Payment goes to Taranom.

### Admin / accountant

1. Reviews applications with reasons.
2. Manages eligibility, rules, risk flags, payouts.
3. Reconciles ledger to payout batches.

## 7. Information architecture

| Route | Audience | Intent | Indexing |
|-------|----------|--------|----------|
| `/sales-partnership` | public retail | apply / understand program | index if program public |
| `/sales-partners/login` | partner | OTP/password | noindex |
| `/sales-partners` | partner | dashboard | noindex |
| `/sales-partners/catalog` | partner | sellable products | noindex |
| `/sales-partners/orders/new` | partner | draft wizard | noindex |
| `/sales-partners/orders` | partner | list | noindex |
| `/sales-partners/orders/:id` | partner | detail (masked PII) | noindex |
| `/sales-partners/commissions` | partner | estimates vs held/available | noindex |
| `/sales-partners/payouts` | partner | settlements | noindex |
| `/sales-partners/profile` | partner | payout + terms | noindex |
| `/sales-partners/guide` | partner | rules (no legal invention) | noindex |
| `/confirm/sales-partner/:token` | customer | confirm/reject basket | noindex |
| `/admin/sales-partners` | staff | applications / partners | noindex |
| `/admin/sales-partners/rules` | staff | commission rules | noindex |
| `/admin/sales-partners/orders` | staff | attributed orders | noindex |
| `/admin/sales-partners/payouts` | staff | batches | noindex |
| `/admin/sales-partners/settings` | staff | feature flag + hold | noindex |

Existing `/partners` and `/admin/partners` stay Vendor.

## 8. Identity and authorization

### Profile, not a second phone

`SalesPartnerProfile.userId` → `users.id`.

- Applicant OTP may **create** a `CUSTOMER` user if none exists (same as retail OTP).
- Existing `CUSTOMER` keeps one phone and can still shop with `purpose=retail`.
- `VENDOR` and staff phones are rejected for this program (D7/D8).
- `users.role` is **not** changed to a new DB role.

### JWT

- New purpose: `sales_partner`.
- Payload: `{ sub, phone, role: 'SALES_PARTNER', purpose, salesPartnerId, customerId? }`.
- `SALES_PARTNER` is **acting role only**, not `users.role`.
- Tokens are not interchangeable: vendor/admin/retail/wholesale/sales_partner each fail the others’ guards.
- `resolveAuthPurpose` must recognize `sales_partner` **before** the wholesale fallback (today unknown → wholesale).

### Server checks on every partner mutation

1. JWT valid and `purpose === 'sales_partner'`.
2. Profile exists, `status === 'ACTIVE'`, `user.isActive`.
3. Resource `salesPartnerId === req.user.salesPartnerId`.
4. Program mode allows the action (`LIVE` or canary phone).

Suspend/reject/close: strategy fails login; also `passwordChangedAt` stamp so existing JWTs die.

### Staff ACL

New module `salesPartners`. Default: `ADMIN` + `ACCOUNTANT` (payouts) + `SALES_MANAGER` (applications/orders, not payout confirm). Exact matrix in §14.

## 9. Content ownership

| Surface | Owner |
|---------|-------|
| Layout, tokens, validation, state machines, prices, commission math | code |
| Public intro headlines, guide FAQ, hero image | CMS later; MVP code + placeholder |
| Legal terms | owner/counsel (`termsVersion`) |
| Product photos | existing media; admin flag «مجاز برای همکار» on eligibility row |
| Feature flag, hold days, SMS caps | admin settings `salesPartners` JSON |

Missing content: show empty/placeholder; never invent «پرفروش» or scarcity.

## 10. Data model

New tables only. No reuse of `vendors` / `vendor_ledger_entries`.

### `sales_partner_profiles`

- `id`, `userId` unique, `phone` unique (normalized `09…`)
- `displayName`, `status`, `statusReason` (human, no secrets)
- `commissionRateOverride` nullable percent
- `ibanEncrypted` or `ibanLast4` + `ibanHash` (no full PAN)
- `termsVersion`, `termsAcceptedAt`
- `riskFlags` jsonb (codes only, not the scoring formula)
- `createdAt`, `updatedAt`, `closedAt`

Statuses: `PENDING_REVIEW | NEEDS_INFORMATION | ACTIVE | SUSPENDED | REJECTED | CLOSED`

### `sales_partner_applications`

- `id`, `phone` (unique among open apps), `displayName`
- `socialHandles` jsonb
- `status`, `reviewNote`
- `userId` nullable until OTP
- `profileId` nullable
- unique partial index: one open application per phone (`PENDING_OTP`, `PENDING_REVIEW`, `NEEDS_INFORMATION`)

### `sales_partner_order_drafts` / `_items`

- partner, status, customer phone (hashed + masked after convert)
- confirmation `tokenHash`, `expiresAt`, `sentCount`, `lastSentAt`
- server-priced snapshots (not client totals)
- `convertedOrderId` unique when set

Draft statuses: `DRAFT | AWAITING_CUSTOMER_CONFIRMATION | CUSTOMER_CONFIRMED | CONVERTED_TO_ORDER | EXPIRED | CANCELLED | REJECTED_BY_CUSTOMER`

### `sales_commission_rules`

- `scope`: `PROGRAM | CATEGORY | PRODUCT | PARTNER_CATEGORY | PARTNER_PRODUCT`
- `percentBps` or `percent` integer (store **basis points**, 1250 = 12.50%)
- `startsAt`, `endsAt`, `active`
- `productId`, `categoryId`, `salesPartnerId` nullable
- `createdBy`, `note`, `version`

MVP: percent only. Precedence: partner+product → partner+category → product → category → program default.

### `sales_commission_snapshots`

- per order item at convert time
- rule id + version + percent + eligible net IRR + estimated commission
- immutable

### `sales_commission_ledger_entries`

- `salesPartnerId`, `orderId`, `orderItemId`
- `amountIrr` signed bigint
- `entryType`: `COMMISSION_EARNED | COMMISSION_REVERSAL | MANUAL_ADJUSTMENT | PAYOUT | PAYOUT_REVERSAL`
- `availableAt`, `idempotencyKey` unique, `reasonCode`, `createdBy`, `createdAt`
- never updated except forbidden; corrections = new rows

### `sales_partner_payouts` / `_items`

- batch amount, reference, paidAt, method, admin id, note, optional MinIO receipt key
- items point at earned entries; unique so an entry cannot be paid twice

### `sales_partner_audit_events`

- actor, action, target type/id, before/after refs (no IBAN/OTP), ip hash, createdAt

### `sales_partner_product_eligibility`

- `productId` unique
- `eligible`, `allowedImageKeys` jsonb
- `marginCheck` jsonb (internal; never shown to partner)
- `updatedBy`, `updatedAt`

Default: not eligible. Vendor/dropship products stay ineligible until opt-in + guard.

### Order columns (Phase 3 migration, additive)

```text
orders.salesSource        varchar  default 'DIRECT'   -- DIRECT | SALES_PARTNER
orders.salesPartnerId     uuid     null
orders.salesPartnerSubmissionId uuid null
```

- Immutable after convert except admin attribution change + audit.
- Do not change `orders.type`.
- Do not write `affiliateId` on these rows.

### Sensitive fields

| Field | Store | Log | Partner API | Public |
|-------|-------|-----|-------------|--------|
| OTP / confirmation token | hash only | never | never | never |
| Customer phone after convert | last-4 + hash | last-4 | masked | no |
| Customer address | order only | no | no after confirm | customer page only |
| IBAN | hash + last4; ciphertext if KEK present | last4 | masked | no |
| Vendor costs / margin | eligibility row | admin | no | no |
| Risk score formula | code | no | no | no |

Draft expire job: after `draftTtlHours`, set `EXPIRED` and anonymize customer phone/name on non-converted drafts.

## 11. State machines

### Profile

```text
PENDING_REVIEW → ACTIVE | NEEDS_INFORMATION | REJECTED
NEEDS_INFORMATION → PENDING_REVIEW | REJECTED
ACTIVE → SUSPENDED | CLOSED
SUSPENDED → ACTIVE | CLOSED
REJECTED → (new application only; same profile stays REJECTED)
CLOSED → (terminal)
```

Only `ACTIVE` may create drafts or send confirmation.

### Draft

```text
DRAFT → AWAITING_CUSTOMER_CONFIRMATION | CANCELLED | EXPIRED
AWAITING_CUSTOMER_CONFIRMATION → CUSTOMER_CONFIRMED | REJECTED_BY_CUSTOMER | CANCELLED | EXPIRED | DRAFT (admin/partner cancel-to-edit before confirm)
CUSTOMER_CONFIRMED → CONVERTED_TO_ORDER (same txn)
CONVERTED_TO_ORDER terminal
```

Convert is idempotent: unique `convertedOrderId` + idempotency key `sales-partner-convert:{draftId}`.

After convert, **order FSM is the source of truth**. Do not duplicate payment/shipping states on the draft.

### Commission lifecycle (ledger, not a mutable status column)

1. Convert: snapshot + **estimate only** (no ledger row).
2. Valid payment (`applyCapturedPayment` / paid): `COMMISSION_EARNED` with `availableAt = deliveredAt + hold` once delivered; until delivered the row may exist as not-yet-available (`availableAt` null or far future). Implementation: insert earned on **paid** with `availableAt = NULL`; on **order DELIVERED** set `availableAt = now + holdDays` via a new `availability` update **only if** we treat availableAt as the hold clock — prefer: insert earned on paid (`held`); job promotes when `deliveredAt + hold <= now`.
3. Hold job: earned entries with `deliveredAt + holdDays <= now` and no open RMA become **available** (computed: `availableAt <= now`).
4. Payout batch: `PAYOUT` negative + item links.
5. Cancel/unpaid: no earned, or full reversal.
6. Partial return: reversal for returned items only, from snapshot.
7. Return after payout: reversal + negative balance deducted from future available.

`PENDING` in the product brief maps to earned-but-not-delivered.  
`HELD` = delivered, `availableAt` in the future.  
`AVAILABLE` = `availableAt <= now` and not paid/reversed.  
`PAID` = covered by payout items.  
`REVERSED` = reversal entries exist.

Do not auto-release if `commissionHoldDays` is unset.

## 12. Commission math

```text
eligibleNetMerchandiseIrr = sum(lineTotalAfterAllocatedDiscount) 
  − shipping 
  − tax/fees if any 
  − wallet is NOT subtracted from merchandise (wallet is tender)

commissionIrr = floor(eligibleNetMerchandiseIrr * percent / 100)
```

- Integer IRR only. No float.
- Order-level discount allocated to lines with largest-remainder so cents/ریال sum equals order discount.
- Snapshot at convert; later rule edits do not rewrite history.
- Rounding policy: **floor per line**, then sum. Tested.

Margin guard (admin opt-in of a vendor SKU):

```text
retailNet = priceAfterDiscount
vendorDue = goods − vendorCommission   // existing snapshot formula, internal
partnerDue = floor(retailNet * partnerPercent / 100)
otherKnownFees = shipping is customer-paid; ignore
margin = retailNet − vendorDue − partnerDue
```

Reject enable if `margin < minMarginIrr` (setting, default 0). Never expose vendorDue to partner/customer.

## 13. APIs

Versioned `/v1`. Explicit DTOs. No entity dump.

**Public**

- `GET /v1/sales-partner-program/public-settings` — `{ enabled, applyOpen, termsVersion }` only
- `POST /v1/sales-partner-applications`
- `POST /v1/sales-partner-applications/verify`

**Partner (`purpose=sales_partner`)**

- `GET /v1/sales-partners/me`
- `PATCH /v1/sales-partners/me` (display name, IBAN; not status)
- `GET /v1/sales-partners/catalog` / `:productId`
- `POST|PATCH /v1/sales-partners/order-drafts[/:id]`
- `POST /v1/sales-partners/order-drafts/:id/request-confirmation`
- `POST /v1/sales-partners/order-drafts/:id/cancel`
- `GET /v1/sales-partners/orders[/:id]`
- `GET /v1/sales-partners/commissions`
- `GET /v1/sales-partners/ledger`
- `GET /v1/sales-partners/payouts`

**Customer (token in path, hashed lookup)**

- `GET /v1/sales-partner-confirmations/:token`
- `POST /v1/sales-partner-confirmations/:token/confirm`
- `POST /v1/sales-partner-confirmations/:token/reject`

**Admin**

- applications CRUD-lite (list, get, approve, need-info, reject)
- partners list/patch/suspend/reactivate/revoke-sessions
- rules CRUD + preview
- eligibility + margin preview
- attributed orders + attribution change
- payout draft/confirm (idempotency key required)
- settings
- reports / audit

Error semantics: 400 validation, 401 purpose/session, 403 ownership/status, 404 hidden (no leak), 409 conflict (stock, convert, payout), 429 rate limit.

## 14. Permission matrix

| Action | Applicant | Partner ACTIVE | Partner other | CS | Sales mgr | Accountant | Admin |
|--------|-----------|----------------|---------------|----|-----------|------------|-------|
| Apply | yes | no | no | — | — | — | — |
| Create draft | — | yes | no | — | — | — | — |
| See customer full address | — | no | no | yes | yes | no | yes |
| See other partner data | no | no | no | no | yes | yes | yes |
| Change attribution | no | no | no | no | no | no | yes |
| Confirm payout | no | no | no | no | no | yes | yes |
| Enable vendor SKU | no | no | no | no | no | no | yes |
| Export customer PII | no | no | no | no | no | masked | masked |

## 15. Trust boundaries and threat model

| Threat | Mitigation |
|--------|------------|
| Price spoof | Server recomputes price/stock/commission |
| IDOR between partners | purpose + ownership helpers + tests |
| Token reuse | hash, single-use, TTL |
| Double convert / pay / commission / payout | unique keys + row locks |
| Self-referral | D2 block |
| Mass draft / SMS abuse | rate limit partner + phone + IP + daily cap |
| Suspended partner still converting | status check at confirm + convert |
| Mass assignment | allowlisted DTOs |
| Vendor margin leak | strip internals |
| Double commission with CPA | no `affiliateId` on partner orders |
| Log secrets | never log OTP/token/IBAN |
| Concurrent last SKU | convert uses same stock check + payment commit as retail; conflict 409 |
| Negative balance | allowed; payout blocked until ≥ min |

## 16. Failure scenarios (expected behavior)

| # | Event | Behavior |
|---|-------|----------|
| 1 | Two partners sell last unit | One convert wins; other 409 stock |
| 2 | Double confirm click | Idempotent; same order id |
| 3 | Timeout after order created | Client retries same idempotency key; returns existing |
| 4 | Price change before confirm | Recalc; customer sees new total or 409 if delta > `priceDriftMaxBps` |
| 5 | Variant gone | 409; draft item flagged |
| 6 | Partner suspended after SMS | Confirm page explains; no convert |
| 7 | Confirmed, unpaid | Order `AWAITING_PAYMENT`; estimate only; no available |
| 8 | Payment callback retry | existing payment idempotency |
| 9 | Cancel | reverse earned; stock via existing `reverseEffects` |
| 10–11 | Return before/after available/paid | item-level reversal; after paid → negative ledger |
| 12 | Rule change later | snapshots unchanged |
| 13 | Mixed percents | per-line snapshot |
| 14 | Order discount | largest-remainder allocation |
| 15 | Wallet | not in eligible merchandise |
| 16 | Shipping | not in eligible merchandise |
| 17 | Double payout click | idempotency + unique item |
| 18 | Two hold jobs | unique idempotency on promote |
| 19 | Cross-partner GET | 404 |
| 20 | Customer phone is existing user | allowed; no wallet/history leak to partner |
| 21 | Vendor SKU | blocked unless eligible + guard |
| 22 | External affiliate + partner | partner source wins; no postback |
| 23 | SMS fail | outbox retry; partner sees «ارسال نشد»; no fake success |
| 24 | Expired draft, open page | 410/409; no convert |
| 25 | Stock change after confirm before pay | existing retail settle rules |
| 26 | Client sends COD when off | 400 |
| 27 | Negative adjustment | balance can go negative; no silent wipe |
| 28 | Timezone | store UTC; display `Asia/Tehran` |

## 17. Events (outbox)

New event types (do not overload `affiliate.postback`):

- `sales_partner.application.submitted`
- `sales_partner.profile.status_changed`
- `sales_partner.draft.confirmation_requested`
- `sales_partner.draft.customer_confirmed`
- `sales_partner.draft.customer_rejected`
- `sales_partner.draft.expired`
- `sales_partner.commission.available`
- `sales_partner.payout.recorded`
- `sales_partner.commission.reversed`

Payload: ids + status codes only. No IBAN, OTP, full address.

Paid/shipped/delivered reuse existing `order.status_changed.notification`. A SalesPartner consumer updates ledger from those events **and** a periodic reconcile job (Pevey/Medusa pattern: watermark, never overwrite timestamps).

## 18. UX / visual direction

- Mobile-first RTL, Vazirmatn, existing `--brand-green` / `--brand-gold` / `--brand-ivory`.
- Copy Partner **portal shell** structure (bottom nav on small screens, side nav on `md+`), retail tokens — not Vendor gray shell.
- WCAG 2.2 AA: labels always visible, focus-visible, 44px targets, `aria-live` for status, `prefers-reduced-motion`.
- Icon-only controls have `aria-label`. Real `<a>`/`<Link>`. Animate transform/opacity only.
- States on every list: loading, first-empty, filtered-empty, stale, validation, system, denied, suspended, expired, conflict, success.
- Do not mix «فروش ثبت‌شده» with «پورسانت قطعی».
- H2H voice: no guaranteed income. Approved sentence:

«شما محصول را معرفی و مشتری را برای تصمیم‌گیری راهنمایی می‌کنید. ترنم قیمت، موجودی، پرداخت، بسته‌بندی، ارسال و پشتیبانی سفارش را انجام می‌دهد. پورسانت هر سفارش پس از تحویل و پایان مهلت مرجوعی قابل‌برداشت می‌شود.»

## 19. Deployment, flag, rollback

- Additive migrations only. Default flag `mode=OFF`, `enabled=false`.
- Rollback: set flag OFF; existing orders keep retail lifecycle; do not drop tables with data.
- Down migrations exist for empty/new tables; after production data, roll forward with flag off.
- Backup before first production migrate (standard VPS dump).
- No second service. Modular monolith `SalesPartnerModule`.

## 20. Testing strategy

Standalone policy specs (like `staff-access.spec.ts`) plus Nest integration where IO matters.

Mandatory: commission rounding/precedence, draft FSM, ledger policy, IDOR, purpose isolation, convert idempotency, price/stock recalc, payment callback (existing), partial return, payout concurrency, vendor margin guard, SMS failure, RTL/a11y smoke.

Do not weaken existing tests.

## 21. Industry references (chosen, not copied)

Inspected patterns (2026-09-22):

- **Immutable signed ledger + clawback** — do not mutate earned rows ([DEV: claw back commissions](https://dev.to/mihirkanzariya/clawing-back-affiliate-commissions-when-a-customer-refunds-design-the-ledger-first-1fk9)).
- **`eligible_at` / hold after delivery** — `medusa-referral-affiliate` (`eligible_at`, reverse on cancel/return, min payout).
- **Attribution timestamps never overwritten + nightly watermark reconcile** — Pevey Medusa affiliates.
- **Taranom Vendor ledger** — hold → available → paid is the local operational pattern to **mirror**, not reuse.

Rejected: putting partner ids in `affiliateId`; Saleor/Solidus plugins (no maintained fit); Refferq as a second app (ops cost).

## 22. Phased execution

| Phase | Outcome | Stop before |
|-------|---------|-------------|
| 0 | This doc + claims | coding finance without decisions |
| 1 | Tables, purpose, apply, admin review, audit, isolation tests | catalog |
| 2 | Eligibility, rules, snapshot calculator, margin guard | drafts |
| 3 | Draft, SMS, confirm page, convert to `RETAIL_WEBSITE` | ledger jobs |
| 4 | Paid/delivered/return ledger + jobs | full partner UI polish |
| 5 | Partner panel states | payout batches |
| 6 | Admin payouts/reconciliation | live enable |
| 7 | Independent Reviewer + Security, gates, flag rehearsal | enabling LIVE |

Each phase is its own commit. Feature stays OFF until Phase 7.

## 23. File claims (this task)

New module and routes listed in `.ai-dos/tasks/active.yaml`. Shared auth files are **reclaimed from stale TASK-20260904-001** (heartbeat 2026-09-03). Not claimed: `order.service.ts`, `create-order.dto.ts`, `payment.service.ts` (still held by other in_progress tasks). Phase 3 convert uses a facade calling `OrderService.create` without editing those files if possible. Order column migration is additive and owned here.

## 24. Reviewer and Security

High-risk: auth, PII, orders, money.

- Implementer: `cursor:implementer-TASK-20260922-003`
- Reviewer: independent agent (not implementer)
- Security: independent agent (not implementer)

Done requires both recorded in handoff with evidence.
