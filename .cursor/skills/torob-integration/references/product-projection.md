# Shared product projection

PostgreSQL (or the shop DB) is the only source of truth. API, XML feed, PDP metatags, and parity tools must call the same pure functions.

## Discover before coding

1. Currency of stored prices (IRR vs Toman). Convert **once**.
2. Which stock field is retail. Never leak wholesale/legacy stock into Torob availability.
3. How variants are identified. `page_unique` must survive slug/SKU/name changes — use the variant UUID.
4. Product-without-variants namespace must not collide (`product:{uuid}`).

## Default option

Deterministic, never DB relation order:

1. Configured default variant if it still exists
2. First in-stock retail variant in stable admin order (`createdAt`, then `id`)
3. First variant in that order

PDP `?variant=` is read on the server. Invalid IDs fall back; do not canonicalize a forged URL.

## Change cycle

Create/edit/price/retailStock/image/visibility/guarantee/option updates appear on the next API read. Touch `date_updated` in the same transaction as retail stock changes. Hide/soft-delete removes the option from list and lookup immediately. Restore republishes if still valid. Slug change keeps `page_unique` and returns the new `page_url`.

Transactional outbox is for audit, cache invalidation, and monitoring — not a second product catalog.

## Images

Absolute HTTPS. First `image_links` item is the option's main image. Reject thumbnails and images below Torob's minimum (commonly 400px). Incomplete products (e.g. missing image) stay unpublished and appear in an admin incomplete report. Do not invent images.

## Guarantee

Nullable product field, max 200, sanitized. Omit when empty. Never hard-code.
