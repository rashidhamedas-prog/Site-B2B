# Public channel stock isolation — 2026-08-31

Residual after independent phase review of the dual-worker wave.

## Change

- `withBadges` reads `wholesaleStock` / `retailStock` only (no `product.stock` / `variant.stock` fallback).
- Public `channel=RETAIL` omits wholesale stock and wholesale price fields.
- Public `channel=WHOLESALE` omits retail stock and retail price fields.
- Admin responses (`channel` unset) keep both columns.
- `findAllWithVariants` (inventory) keeps both columns; `stock` now matches the requested channel.

## Gates

- `npx ts-node --transpile-only src/modules/product/channel-stock-isolation.spec.ts` → exit 0
- `npx tsc --noEmit` in `apps/api` → exit 0

## Still not Done

Connectors remain off. 24h dual-worker soak, destination canary, and §9 business decisions are still required.
