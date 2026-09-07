# TorobPay CPG retail (TASK-20260907-002)

## What shipped

Retail TorobPay installment CPG, wired the same way as DigiPay UPG:

- Admin `/admin/settings` payment tab: enable toggle, four activation fields, connection probe.
- `POST /v1/payments/torobpay/connection-test` is ADMIN + AdminOnly. Response is stage/failureClass/eligible only — no secrets or tokens.
- Retail checkout shows «ترب‌پی (اقساطی)» only when `torobpayEnabled` and all four fields are present.
- Default ONLINE gateway remains ZarinPal. Wholesale is unchanged.

## Official contract used

Source: owner PDF `TorobPayCPG.pdf` (v1.3.3, April 2026). Host `https://cpg.torobpay.com/`.

| Step | Method | Path |
| --- | --- | --- |
| OAuth | POST | `/api/online/v1/oauth/token` Basic `client_id:client_secret` + JSON username/password |
| Eligible (probe) | GET | `/api/online/offer/v1/eligible?amount=` Bearer |
| Create | POST | `/api/online/payment/v1/token` cart + address + `ONLINE_CREDIT` |
| Verify | POST | `/api/online/payment/v1/verify` `{ paymentToken }` |
| Settle | POST | `/api/online/payment/v1/settle` required the same day after verify |

Callback is POST form `transactionId`, `state=OK|FAILED`, `amount` to `returnURL` (`/payment/torobpay/callback?paymentId=`).

## Secrets

Never committed. Owner pastes the four values from «اطلاعات فعال‌سازی درگاه» into admin settings, then presses «تست اتصال». Env fallbacks are `TOROBPAY_*` in `.env.example` as `CHANGE_ME`.

## Rollback

Disable the admin toggle or leave fields empty. `TOROBPAY` stays hidden from eligible. Down migration only marks the registry row disabled.
