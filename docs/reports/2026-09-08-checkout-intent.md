# Checkout intent — TASK-20260908-004

Continues the customer-marketing plan leftover that was blocked while checkout was claimed.

## Behavior

- Logged-in shopper on `/retail/checkout` or wholesale `/checkout` posts `POST /v1/storefront/marketing/checkout-intent` after ~8s idle (throttle 60s).
- Table `marketing_checkout_intents` stores one open row per `(customerId, channel)`.
- `retail.checkout.abandoned` may queue only when: open intent ≥30 minutes, no settled order since intent, no FAILED payment since intent, not already queued for this intent.
- Order create completes the intent. Default `customerMarketing` stays OFF.

## Non-goals

- Full server cart sync
- PDP browse / restock
- LIVE send
