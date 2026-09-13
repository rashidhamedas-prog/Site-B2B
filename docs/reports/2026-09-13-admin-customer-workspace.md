# TASK-20260913-011 — Admin customer workspace + wallet

Date: 2026-09-13

## Outcome

`/admin/customers` is a synced CRM workspace (list filters in the URL, full customer record tabs, shared status/channel labels). Customer wallet is now a ledger with a cached balance, visible to staff and the signed-in shopper.

## Evidence

- List query: `channel`, `q`, `status`, `segment` survive refresh.
- Record tabs: هویت، آدرس‌ها، سفارش‌ها، کیف پول، بازاریابی.
- Marketing board uses the same `?channel=`.
- Positive wallet balance is shown (previously rendered `—`).
- `POST /v1/customers/:id/wallet` writes ledger + cache.
- `GET /v1/account/wallet` is the shopper book.
- Retail `/account/wallet` and portal `/portal/dashboard/wallet`.

## Product image alt

Already live from TASK-20260913-010: per-image `imageAlts`, filled on save, used on PDP/cards/OG/JSON-LD. This task did not reopen those files.

## Residual

- RMA wallet credit is still raw SQL (`rma.service.ts`, TASK-20260826-001). New `updateBalance` will ledger order/invoice/admin paths; RMA rows need a later wrap.
- Order apply/refund ledger reason stays `ADJUSTMENT` until `order.service` can pass meta.
- Independent Reviewer + Security still required (payments + PII).
- Live admin click and shopper wallet after deploy are not claimed until exercised.

## Research

Medusa store-credit concepts, Shopify store credit admin/API, ledger-not-counter write-up. Slack: no matching public messages.
