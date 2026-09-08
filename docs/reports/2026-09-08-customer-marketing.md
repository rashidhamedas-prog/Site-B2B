# Customer marketing sidecar — TASK-20260908-002

Sidecar module `customer-marketing` under Admin CRM. No consent columns on `customers`. `/admin/marketing` still redirects to discounts. `/v1/crm` untouched.

## Default (safe)

- `customerMarketing.enabled = false`, `mode = OFF`
- `treatRegisterAutoAsPromoConsent = false`
- `retail.browse.no_buy_24h` and `wholesale.restock.ping` locked OFF
- No checkout_intent (checkout files claimed by other tasks)
- Transactional SMS (OTP / order / wholesaleApproved) unchanged

## Surfaces

- `/admin/customers/marketing` — today / funnel / templates+rules
- `/admin/customers/[id]` — 360 dossier, `tel:` + call result, SMS preview
- API `/v1/marketing/*` and `/v1/customers/:id/marketing/*`
- LIVE / opt-in / settings / canary: `@AdminOnly`

## Outbox (always leased)

`customer.registered.marketing`, `customer.approved.marketing`, `marketing.send.requested`, `marketing.campaign.dispatch`. Payload has ids only, never phone.

## Review remediations

- `MarketingSmsSender.deliverById` re-runs `recheckDelivery` (kill switch + consent + suppression).
- Opt-out and customer soft-delete cancel `QUEUED`/`SENDING` rows and write `marketing_suppressions`.
- Templates and campaigns accept only `NURTURE` | `PROMO`. Queue coerces anything else to NURTURE.
- `dispatchCampaign` / `goLiveCampaign` require `customerMarketing.enabled && mode === LIVE`.
- Settings resolver forces `enabled=false` unless mode is CANARY or LIVE. Hub radio matches.
- Independent Reviewer + Security still required before marking the task done. Do not flip LIVE on deploy.
