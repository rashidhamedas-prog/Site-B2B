# Customer panel security — 2026-09-12

Live retail (`.ir/account`) and wholesale (`.com/portal`) share one API. JWT `purpose` is `retail` vs `wholesale`. This change closes IDOR/leak paths found with a real retail customer session.

## What shipped

- Invalid invoice id returns **400**, not a Postgres **500**.
- Customer `GET /invoices/:id` and PDF require the invoice `customerId` to match the shopper.
- Customer invoice list with no `customerId` returns an empty page (staff unscoped list unchanged).
- Shopper order list is forced to `RETAIL_WEBSITE` or `WHOLESALE` from JWT purpose; opposite-channel order detail is **403**.
- Retail profile omits `creditLimit`, `segment`, `customerCode`. `totalSpent` is channel-filtered.
- Retail account home shows an error instead of a fake 0 wallet when the API fails.
- Wholesale login password toggle has an accessible name.

## Evidence

- Before (live): `GET /invoices/not-a-uuid` → 500; retail profile JSON included wholesale-only keys; retail JWT could query `type=WHOLESALE`.
- Specs: `invoice-access.spec.ts`, `shopper-channel.spec.ts`.

## Out of scope / leftovers

- Shopper JWT still in `localStorage` (not HttpOnly).
- Wholesale notifications page is a stub; retail wishlist is localStorage-only.

WORKLOG/status/handoff were not edited: TASK-20260912-004 currently claims those files.
