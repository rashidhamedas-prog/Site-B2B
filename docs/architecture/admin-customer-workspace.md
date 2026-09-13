# Admin customer workspace + wallet ledger

Confirmed 2026-09-13. Completes `/admin/customers` without a second CRM/Salesforce.

## Facts

- One `customers` row already serves retail OTP accounts and wholesale portal buyers. Channel SoT is `type` (`B2C`/`RETAIL` vs everything else).
- List was a modal CRUD. Detail (`/admin/customers/:id`) was only the marketing dossier. Balance existed as a cache column and was **hidden when positive**.
- Checkout already debits `customers.balance` on retail `useWallet`. RMA still does raw SQL credit (owned by TASK-20260826-001). Invoice credit uses `updateBalance`.
- Slack public search (2026-09-13) had no CRM/wallet decisions.

## Research used (not installed)

| Source | Takeaway applied here |
| --- | --- |
| [Medusa Store Credit](https://docs.medusajs.com/resources/commerce-modules/store-credit/concepts) | Append-only `AccountTransaction`; credit/debit + reference; balance from history |
| [Shopify storeCreditAccountCredit](https://shopify.dev/docs/api/admin-graphql/latest/mutations/storeCreditAccountCredit) | Staff credit/debit on the customer profile; reason; currency-specific (here one IRR cache) |
| [Shopify Help: Store credit](https://help.shopify.com/en/manual/customers/store-credit) | Balance + history on the customer record; checkout apply is a separate surface |
| [D2C wallet as ledger](https://dev.to/ujjawal_tyagi_c5a84255da4/why-every-d2c-wallet-should-be-a-ledger-not-a-counter-2kok) | Ledger is SoT; cached balance is a projection updated in the same txn |
| Saleor customer admin | Profile is a record with sections, not a second app |
| Ghost/Payload + our product/blog workspaces | One `?channel=` query is the list/marketing filter SoT |

## Decisions

1. Workspace query: `?channel=ALL\|RETAIL\|WHOLESALE&q=&status=&segment=&tab=&mtab=`.
2. Record tabs: identity / addresses / orders / wallet / marketing. Marketing board keeps `/admin/customers/marketing` but the same `channel`.
3. Wallet is `customer_wallet_entries` (append-only) + existing `customers.balance` cache. No second currency account (all IRR).
4. Admin credit/debit requires note + idempotency. DTO cannot set `balance`/`code`/`id`.
5. Shopper read is `GET /v1/account/wallet` (avoids claiming `auth.controller`).
6. Image alts stay with TASK-20260913-010 (`imageAlts` on products). Not reopened.

## Non-goals

- Wholesale checkout wallet apply (still retail-only)
- Gift cards, expiry, claim codes (Medusa/Shopify extras)
- Editing savedAddresses from admin
- Changing RMA raw SQL (026 claim)
- Passing reason meta from `order.service` (006/008 claims)

## Security

- Admin JWT for CRM writes. Shopper JWT can only read own wallet.
- Notes stripped of HTML/C0. Amount capped. Idempotency unique.
- Mass-assignment of balance closed by `UpsertCustomerDto`.
