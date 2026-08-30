# Framework recipes

No framework is mandatory. Route to the shop's stack.

## Next.js + NestJS (this repo)

- Nest `POST /v1/torob_api/v3/products` behind nginx on `api.*` with no redirect
- Shared projection in API + `@taranom/shared-types` for PDP meta
- Next `generateMetadata().other` for crawler metatags
- Paginated sitemap with last-known-good cache

## WooCommerce / WordPress

- Custom REST route or small plugin that reads `_price` / `_stock` from the **retail** product
- One row per purchasable variation; `page_unique` = variation UUID/ID that never changes
- Serve JWT validation in PHP with Ed25519 (libsodium / suggested official samples)
- Keep feed and API on the same mapper

## Laravel / PHP

- Single `TorobProductProjector` class used by controller, feed, and Blade `<meta>`
- Config `TOROB_API_AUDIENCE` only
- Paginate with `page` + stable `orderBy` + `id` tie-break

## Custom storefront

- Same invariants. Prefer reading the live catalog table, not a generated static JSON file.
- If you already have an XML feed, make it consume the projector instead of a second price formula.
