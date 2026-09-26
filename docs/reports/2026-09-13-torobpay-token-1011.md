# TorobPay token 1011 (TASK-20260913-002)

## Brief

Live retail checkout `ORD-2026-00037` (`bbbe0438-dd1b-4858-92cc-55f3e3155609`) selected TorobPay and saw:

«ترب‌پی نتوانست سفارش را ثبت کند. آدرس را کامل‌تر بنویسید (خیابان و پلاک)…»

Local form already had province, city, a long street, plaque `137`, and postal `9157765383`.

## 2026-09-26 — root cause confirmed (live CPG probe)

OAuth with stored admin credentials succeeds. Then:

- `GET /api/online/offer/v1/eligible?amount=100000` → **HTTP 403**, `errorCode=1100`, **`merchant no active contract`**
- `POST /api/online/payment/v1/token` (totweb-minimal, snake_case cart, toman/10, with/without address) → always **1011** `can't create order`

Panel shop `تولیدی پوشاک ترنم` / `poshaktaranom.ir` still shows **0** successful orders. Payload experiments cannot create a payment until TorobPay activates the merchant contract.

Code fix this turn: admin connection probe and checkout start now hard-fail with a clear «قرارداد پذیرنده فعال نیست (۱۱۰۰)» message instead of soft-success / opaque 1011.

**Owner action required:** in پنل ترب‌پی → «اطلاعات فعال‌سازی درگاه» complete/activate the contract, or contact TorobPay support for client `19350107`. Re-run admin «تست اتصال» until it reports ready (not 1100). Then retry a real checkout.

## Confirmed

- Order `shippingAddress` street was `میدان عسگریه ، خیابان قائمی بین 10 و 12 پلاک 137، پلاک 137، پلاک 137`.
- Client checklist passed; CPG `POST /api/online/payment/v1/token` returned 1011 (`can't create order`).
- Adapter mapped every 1011 to an address-incomplete sentence (TASK-20260907-002 / 20260912-004).
- totweb + shetabit token bodies send `amount`, `paymentMethodTypeDto`, `returnURL`, `transactionId`, `mobile`, `cartList` — not `registration_phone_number` or tax flags.
- TorobPay panel shop `تولیدی پوشاک ترنم` / `poshaktaranom.ir` is logged in; 0 successful orders.

## Assumptions

- CPG address parser treats duplicate `پلاک` as persist failure (1011), not a field-level 400.
- `registration_phone_number` means a TorobPay-registered phone, not the shipping mobile.
- Amounts stay IRR, same as ZarinPal/DigiPay in this repo. Decision requiring confirmation: whether CPG ever wants toman.

## Change

- Compose/hydrate peel every `پلاک` suffix (comma or inline) so the stored line has one plaque.
- Adapter `sanitizeTorobpayStreet` before token; totweb cart; `customerFullName` + snake alias; no registration phone / tax flags.
- `/payments/start` accepts `shippingAddress` and writes it onto the unpaid order (retry no longer reuses a stale JSON line).
- 1011 shopper copy asks to retry or use ZarinPal.

## Non-goals

National geocoder, merchant onboarding, changing CPG amount unit, live money on a new order.

## Validation

- `npx tsx apps/web/src/lib/shipping-address.spec.mts` → `shipping-address spec ok`
- `npx tsx apps/api/src/modules/payment/adapters/torobpay.adapter.spec.ts` → `PASS` (1011 → totweb-minimal retry covered)
- `apps/web` `tsc --noEmit` exit 0
- `apps/api` `tsc --noEmit` exit 0
- Live VPS `216ff56`: health 200
- Live `ORD-2026-00037` `POST /payments/start` TOROBPAY still HTTP 400 1011 after:
  1. sanitized street `streetLen=48` (`میدان عسگریه، خیابان قائمی بین 10 و 12، پلاک 137`)
  2. totweb-minimal retry (no address / name / city / postal)
- API log: `amount=14180000` both attempts. totweb docs convert toman→rial (`* 10`); our amount is already IRR, so unit matches.
- Residual: CPG persist 1011 is **not** local address validation. Likely merchant order-insert / credit-user for this mobile, or a CPG-side limit. Panel shop `تولیدی پوشاک ترنم` still shows 0 successful orders. Independent Reviewer + Security residual (payments).
