# Torob Product API v3 contract

Re-read https://github.com/torob/Torob-Sync/blob/main/product_api_v3.md before implementing.

## Endpoint

- Method: `POST`
- Preferred public URL: `https://{api-host}/v1/torob_api/v3/products` with **zero redirects**
- `Content-Type` / `Accept`: `application/json`
- Response `Cache-Control`: `no-store` (or invalidate on every catalog change)

## Request — exactly one mode, no defaults

| Mode | Body |
|------|------|
| list | `{ "page": <int>=1, "sort": "date_added_desc" \| "date_updated_desc" }` |
| urls | `{ "page_urls": ["https://..."] }` (min 1) |
| uniques | `{ "page_uniques": ["..."] }` (min 1) |

Reject with HTTP 400 and `{"error":"<precise message>"}`:

- empty body
- combined modes
- unknown fields
- `page` without `sort` or `sort` without `page`
- `page < 1` or non-integer
- invalid `sort`
- empty `page_urls` / `page_uniques`

## Response

```json
{
  "api_version": "torob_api_v3",
  "current_page": 1,
  "total": 0,
  "max_pages": 1,
  "products": []
}
```

- Page size is 100 except the last page
- `current_page`, `total`, `max_pages` are integers
- `total=0` → `max_pages=1`
- Stable tie-breaker after the sort timestamp (e.g. `page_unique`)

## Product fields (shop-side)

Required: `page_unique`, `page_url` (absolute), `title`, `current_price` (integer Toman, never null), `image_links` (first is main), `date_added` (timezone-aware ISO-8601), `availability` (boolean)

Optional: `product_group_id`, `subtitle`, `old_price` (only real active discount > current), `short_desc`, `spec` (always `{}` if empty), `guarantee` (omit if empty, max 200), `date_updated` (required if `date_updated_desc` is implemented)

Unpublish: soft-delete, non-ACTIVE, hidden retail, invalid retail price, invalid main image. Out-of-stock **may** remain with `availability=false`.
