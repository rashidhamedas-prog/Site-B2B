# 2026-09-13 — A5 packing slip on confirmed orders

## What

Admin «تأیید شده» (and later fulfillment statuses) now has a preview + A5 print sheet: recipient/sender for the parcel, pick checklist, invoice totals.

## Why this layout

Reviewed common patterns (Shopify/ShipStation packing slips; Iran A5-P / پست label; clothing-shop combined invoice+label). Combined one A5: large گیرنده + 10-box postal, small فرستنده, checklist, money in a secondary block. High-contrast black rules, no gold/gradients.

## Files

- `apps/web/src/lib/packing-slip.ts` + spec
- `apps/web/src/components/admin/AdminPackingSlip.tsx` + `packing-slip.css`
- Wired in `AdminOrders.tsx` and `AdminOrderDetail.tsx`
- `docs/architecture/packing-slip-a5.md`

Did not edit TASK-20260913-002 claims (`shipping-address.ts`, `WORKLOG.md`).

## Security

React text only; existing admin JWT; no new endpoint; mobile digits are not treated as postal.

## Gates

- `npx tsc --noEmit` in `apps/web`: exit 0
- `TS_NODE_COMPILER_OPTIONS={"module":"commonjs"} npx ts-node --transpile-only src/lib/packing-slip.spec.ts`: `packing-slip.spec ok`
- Live VPS `db8d0f0`; `/v1/health` 200; web container restarted 2026-09-13T08:49Z
- Live admin preview/print click: not exercised (no admin session in this session)
