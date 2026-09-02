# Omnichannel channel isolation leftovers — 2026-09-03

Task: TASK-20260826-001  
Branch: `ai/TASK-20260826-001-channel-isolation`  
Base: `259a532` public blog channel

## 1. Goals, non-goals, assumptions

**Goals (CODE this slice)**

- Public collections require `RETAIL|WHOLESALE`. Admin JWT may omit (same as products).
- Discount validate and quote-discounts honor code `channel` (`RETAIL` | `WHOLESALE` | `BOTH`). One discount engine.
- Blog related-products use `channelAvailability` / `isChannelVisible`. Never legacy `p.stock`. Public route requires channel.
- Admin `/admin/omnichannel` completeness for the live screenshot: table headers, empty states, `cursor-pointer` on existing actions. Light ERP theme stays.

**Non-goals / owner-gated**

Live Telegram send, destination canary send, `OMNICHANNEL_CONNECTORS_ENABLED`, `OMNICHANNEL_AUTO_PUBLISH`, worker leftover apply, outbox DELETE, Instagram/Bale/Rubika APIs, SwiftUI/Figma export, dark-theme rewrite, new fonts.

**Assumptions**

- Shared NestJS/Next.js monolith and one PostgreSQL. Channel is a field, not a second backend.
- Storefront already knows its channel. Fail closed if it forgets.
- Admin JWT on public collection GETs is the same optional-JWT pattern as products.

**Success**

Public missing/forged channel → HTTP 400 «کانال نامعتبر است». Cross-channel discount → 400 «این کد برای این کانال معتبر نیست». Related-product `stock` is the requested channel column. Worker still unwired. Connectors off.

## 2. System context

Actors: retail shopper, wholesale buyer, admin staff.  
Trust boundary: public API vs JWT admin. Channel query/body is untrusted on public routes.  
Journeys: retail collections list, wholesale checkout quote, blog related products, admin omnichannel inspect.

## 3. Module map

| Module | Owns | Depends on |
|---|---|---|
| collection | public channel gate + slug/id match | `resolvePublicProductChannel`, OptionalJwt |
| discount | code applies-to-channel | same channel helper |
| order | quote + create-order pass sales channel | discount.validate |
| blog extras | related products projection | `channelAvailability` |
| AdminOmnichannel | store-only UI polish | existing admin APIs |

## 4. Contracts

| Surface | Contract |
|---|---|
| `GET /collections` public | `channel=RETAIL\|WHOLESALE` or 400 |
| `GET /collections` admin JWT | channel optional |
| `POST /discount-codes/validate` | body.channel required |
| `POST /orders/quote-discounts` | `channel` required on DTO |
| `GET /blog/article/:id/related-products` | channel required; stock from channel columns |

Idempotency: reads only except existing quote/create-order paths. No outbox change.

## 5. Security

- Forged `BOTH`/`ALL`/empty channel is 400, not both-channel data.
- Discount `BOTH` is a stored code attribute, not a public query value.
- Admin omit is JWT-gated (`isAdminActor`).
- `secretRef` unchanged. No live send.

## 6. Deployment / rollback

No migration. Revert this commit. Do not DELETE outbox rows. Flags stay off.

## 7. Tests

- `collection-public-channel.spec.ts`
- `discount-channel.spec.ts`
- `omnichannel-phase-acceptance.spec.ts`
- `apps/api` and `apps/web` `tsc --noEmit`

## 8. CODE vs owner-gated

**CODE now:** collections, discount channel, related-product stock, admin table polish.

**Later CODE (not this commit):** `GET /blog/authors/:slug` still mixes channels; empty `autoPublishEventTypes: []` can set `*Chosen=true` (inert until worker wired); `useSiteChrome` / JsonLd WHOLESALE defaults; create-order still trusts client `channel` (bind to session/customer type later). Quote-discounts now skips wholesale tiered/side on RETAIL, matching create-order.

**Owner-gated:** live Telegram, canary send, connector flags, soak, wiring leftovers into the worker.

## 9. UI / design-system note

`/ui-ux-pro-max` recommended a dark Fira dashboard. Rejected: live admin is light ERP (`btn`, white cards, gray borders). `/figma-swiftui` does not apply (Next.js admin, not SwiftUI). Polish only: thead, empty rowspan, cursor-pointer.
