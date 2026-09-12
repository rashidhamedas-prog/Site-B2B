# Checkout shipping address (TorobPay-ready)

TASK-20260912-004. Inspected live checkout, CPG adapter, and official fields used on `POST /api/online/payment/v1/token`.

## 1. Goals, non-goals, assumptions

**Goal:** Shoppers on retail (`.ir`) and wholesale (`.com`) can complete a structured Iranian delivery address once, see field-level guidance, and pay with TorobPay without a false “address incomplete” error.

**Non-goals:** National map picker / Neshan geocoding, changing CPG cart math, new payment providers, guest checkout without account, schema migration of `orders.shippingAddress`.

**Assumptions (labeled):**

- Confirmed: CPG token body uses `address`, `postalCode` (10 ASCII digits), `customer_full_name`, `city`, `province`, `mobile`, `registration_phone_number` (`torobpay.adapter.ts`, report `docs/reports/2026-09-07-torobpay-cpg-retail.md`, PDF v1.3.3).
- Confirmed: Live 1011 was previously cart-shape *and* a 3-character street. Client still rejects street &lt; 8 after stripping spaces, and postal via `/\D/` which **drops Persian digits**.
- Confirmed: Wholesale `/checkout` does not send `shippingAddress`; notes say “آدرس دقیق”.
- Assumption: TorobPay does not publish a public city-code table. Official Persian province/city names are sufficient; custom city stays allowed.
- Assumption: Iranian postal checksum is not required by CPG; 10 digits, not a repeated run, is enough.
- Decision requiring confirmation: whether retail cash/ZarinPal should *require* postal. This task requires postal only for TorobPay; other methods keep it optional but validate if present.

**Success criteria:**

- Persian/Arabic-Indic postal `۹۱۷۳۵۱۲۳۴۵` is accepted and sent as `9173512345`.
- Selecting TorobPay highlights missing CPG fields immediately; submit scrolls to the first invalid field.
- CPG `address` length (no spaces) ≥ 8 after compose (street + alley + plaque + unit, else province+city prefix).
- Wholesale order JSON includes the same address object.
- Checkout JS: no new dependency; no extra network for geo; LCP of home/catalog unchanged.

## 2. System context

Actors: retail shopper, wholesale buyer, API payment module, TorobPay CPG.

Trust boundary: browser form is UX only. API adapter re-validates before token. Secrets stay in settings. Address is PII (confidential); logs already mask mobile — do not log full street+postal together.

Primary journeys:

1. Retail checkout → fill address → choose TorobPay → pay.
2. Retail checkout → ZarinPal/cash (postal optional).
3. Wholesale checkout → fill address → place order (ONLINE still ZarinPal).
4. Account address book (retail + portal) uses the same form so checkout can reuse saved rows.
5. Checkout load / click saved row → hydrate structured fields from composed street + default flag.

## 3. Capability map

| Module | Owner | Depends on |
| --- | --- | --- |
| `shipping-address` (pure) | web lib, mirrored postal helper in adapter | iran digits/geo |
| `ShippingAddressForm` | web checkout component | tokens, geo, validation |
| Retail `/retail/checkout` | web | form + `retailTorobpayAddressError` |
| Wholesale `/checkout` | web | form + `shippingAddress` on POST `/orders` |
| Address book | retail account + portal profile | same form + existing `/auth/me/addresses` |
| TorobPay adapter | api payment | `normalizeDigits`, `composeTorobpayAddress` |

## 4. Component design

Keep a modular monolith. One presentational form, two appearances (`retail` | `wholesale`). Validation is pure and imported by UI + payment UI helpers. Adapter keeps CPG mapping; it does not import Next.

Checkout pages stay client (already `no-store`). Geo list is a static TS module (county seats), not a fetch — avoids waterfall.

## 5. Data model

Existing JSON on `orders.shippingAddress` and customer `addresses[]`:

```text
{ recipient, mobile, province, city, street, postalCode }
```

Form drafts may include `alley` / `plaque` / `unit`. Those are composed into `street` before POST. Saved-address DTO accepts them so a leftover client key does not 400 (`property plaque should not exist`); they are not stored as separate columns.

On checkout (and account edit), `hydrateShippingAddress` parses the composed suffixes (`، کوچه …، پلاک …، واحد …`) back into their own fields so a saved or default row fills every input automatically. Retail checkout also loads `/auth/me/profile` addresses, not only `localStorage`.

Canonical storage: Latin digits for `mobile` and `postalCode`. `street` persisted as the composed line so old admin/fulfillment readers keep working.

Lifecycle: checkout draft in React state → POST order → adapter reads order JSON. Saved book: max 10 server-side, 5 local retail cache.

Sensitive: recipient, mobile, street, postal. Retention = order retention (unchanged). Do not put address in CPG logs beyond `streetLen`.

## 6. API / CPG contract

Token fields (already implemented; this task only hardens values):

| Field | Rule |
| --- | --- |
| `province`, `city` | required trimmed Persian names |
| `address` | composed street, 8–250 chars without counting spaces as filler |
| `postalCode` | exactly 10 Latin digits after Fa/Ar conversion |
| `customer_full_name` | ≥ 3 chars, ≤ 80 |
| `mobile` / `registration_phone_number` | `09xxxxxxxxx` |

Error semantics: client field errors in Persian, active voice. Adapter keeps mapping 1011 → “آدرس را کامل‌تر بنویسید…” only after local checks passed (so 1011 is a provider persist issue, not a digit bug).

Idempotency: unchanged (`pendingPayOrderId` retry).

## 7. Security

- No new PII fields in query strings or GA4.
- Authorization: address book still JWT `/auth/me/addresses`; order create still existing channel guards.
- XSS: text inputs, no HTML.
- Abuse: same checkout rate limits; no bulk geo API.

## 8. Deployment

No migration. Checkout is `no-store`. Roll forward by deploy; rollback = previous web/api image. Observability: existing adapter warn `streetLen`. Backup: unchanged Postgres.

## 9. Critical sequences

```text
Shopper fills form (Fa digits OK)
  → select TOROBPAY
  → form mode=torobpay, checklist + aria-invalid
  → submit
  → finalizeShippingAddress (compose street, latin postal/mobile)
  → POST /orders { shippingAddress }
  → POST /payments/start TOROBPAY
  → adapter normalizeDigits + composeTorobpayAddress
  → CPG /token
```

Failure: invalid local → no order. CPG 1011 after valid local → Persian persist message (existing).

## 10. Tests, rollout, risks, ADRs

Tests: `shipping-address.spec.mts` (Fa postal, plaque compose, hydrate round-trip, default pick); existing `checkout-payment-ui.spec.ts`; adapter postal Fa digits; `customer-addresses` Persian postal.

Rollout: merge to master, auto-deploy. Manual: `.ir/checkout` with TorobPay + Fa postal; `.com/checkout` address panel.

Risks: CPG may still 1011 for cart/merchant reasons (out of scope). City list is not every village — “شهر دیگر” covers that.

**ADR:** Structured Iranian fields + compose, not a map widget. Reason: CPG needs strings, not lat/lng; zero extra JS; matches Digikala-style checkout shoppers already know.

**ADR:** Require postal only for TorobPay. Reason: current ZarinPal/cash orders succeed without it; forcing it on every retail order is a product change not confirmed.
