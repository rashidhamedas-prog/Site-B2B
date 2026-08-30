---
name: torob-integration
description: Connect an Iranian shop to Torob Product API v3, JWT EdDSA validation, shared product projection, crawler metatag fallback, and XML/sitemap parity. Use when integrating Torob, ترب, TorobBot, page_unique, X-Torob-Token, or marketplace product sync.
---

# Torob integration

Official docs are the source of truth. Re-read them before reuse; the contract can change:

- https://github.com/torob/Torob-Sync/blob/main/product_api_v3.md
- https://github.com/torob/Torob-Sync/blob/main/torob_api_token_guide.md
- Panel mirrors: `/s/torobApiV3` and `/s/torob_api_token_guide`

Never invent a private Torob product write API. Torob **pulls** from your endpoint.

## Choose a mode

1. **API-first (recommended)** — `POST /torob_api/v3/products` (or `/v1/torob_api/v3/products`) serving live DB rows.
2. **Metadata fallback** — `product_price`, `availability`, `product_name`, `product_id`, `og:image`, optional `guarantee` in the initial HTML `<head>`. JSON-LD does not replace these.
3. **Sitemap** — one canonical product URL per visible product; never return `[]` on backend failure.
4. **Order sync** — separate GET `/torob/v1/orders`. Do not mix catalog and order contracts.

## Invariants

- One **pure projection** for price, availability, URLs, images, guarantee. Convert currency **once**.
- Discover the shop currency and the retail stock column **before** coding. Do not use wholesale/legacy stock for Torob availability.
- JWT: `X-Torob-Token` required, `X-Torob-Token-Version` exactly `1`, EdDSA/Ed25519 only, official public key, `exp`/`nbf`/`aud` required. `aud` equals the **exact** public API hostname from config, never a domain list, never a client `Host` header.
- Pagination: page size 100; `sort` is `date_added_desc` or `date_updated_desc`; no defaults; exclusive modes; `max_pages` is `1` when `total=0`.
- Variant `page_unique` is a stable UUID. Product-level IDs use a different namespace. Deleted/hidden/unpublishable options disappear from list and lookup.
- No secrets, tokens, or private keys in the skill or git.

## Load next

- [references/api-v3-contract.md](references/api-v3-contract.md)
- [references/token-validation.md](references/token-validation.md)
- [references/product-projection.md](references/product-projection.md)
- [references/framework-recipes.md](references/framework-recipes.md)
- [references/acceptance-checklist.md](references/acceptance-checklist.md)
- Verify with [scripts/verify-torob-contract.mjs](scripts/verify-torob-contract.mjs) (`TOROB_VERIFY_TOKEN` from env, never printed)
