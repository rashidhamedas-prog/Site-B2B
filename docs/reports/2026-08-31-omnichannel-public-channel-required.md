# Public catalog requires channel — 2026-08-31

Follow-up after live `e70e5b6` still returned both channels when `channel` was omitted, and still serialized opposite-channel content/discount fields.

## Change

- Unauthenticated `GET /v1/products`, `/products/:id`, `/products/slug/:slug` require `channel=RETAIL|WHOLESALE` (400 otherwise).
- Admin JWT may omit `channel` and still receive both columns. Admin catalog responses are `private, no-store`.
- `stripOppositeChannelFields` removes opposite-channel stock, price, content, and discount metadata.
- Price min/max filters use the requested channel column.

## Gates

- `public-product-channel.spec.ts` exit 0
- `channel-stock-isolation.spec.ts` exit 0
- `omnichannel-phase-acceptance.spec.ts` exit 0
- `apps/api` `tsc --noEmit` exit 0

## Still not Done

Connectors off. 24h soak, destination canary, and §9 decisions remain.
