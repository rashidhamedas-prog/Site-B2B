# Admin catalog search

Confirmed 2026-10-05. The operator search on `/admin/products` stays in the catalog workspace. The URL remains the shareable record of the committed query. The text field does not.

## What was slow and wrong

- Each keystroke wrote `q` into the URL. `router.replace` then refetched `GET /products/admin` and replaced the table with skeletons.
- The field was controlled by that URL, and both parse and serialize trimmed `q`. A trailing space (the gap before the next word) was deleted. Persian IME composition was committed mid-character, so the text jumped.
- In-flight responses were not tied to the latest query, so an older result could replace a newer one.
- `status=ALL` (the admin default) joined every variant into the paged query. Count and page limits then ran on the joined row set. The list only needs product columns plus a color count; edit loads the full product by id.
- The predicate was `name`, `sku`, and the legacy `fabric` column. The table shows `specs.fabricType`. Searching the fabric on screen missed those rows. Previous ERP SKUs in `product_sku_aliases` were also missed. `%` and `_` in the query were LIKE wildcards.

## Decisions

1. The input keeps a local draft. A commit happens 300ms after typing pauses, on composition end, and on blur. While a Persian/Arabic IME composition is open, nothing is committed.
2. Commit trims only the ends. If that value equals the URL, the URL is not touched, so the trailing space stays in the field.
3. The request uses the committed value directly. A later URL echo does not refetch. A URL change that is not the commit we just sent (clear, back) replaces the committed query and the draft.
4. A newer request aborts the previous one. Rows stay on screen until the new page arrives. The skeleton is only for the first load.
5. The paged query does not join variants. After the page of product ids is known, one read loads only `id`, `productId`, and `color` for those ids, and the list keeps distinct colors. Full variants load only when `includeVariants=1`.
6. Search SQL is a constant predicate. The text is a bound `:catalogQ` with `ESCAPE '\'`. Matching folds yeh/kaf, Persian and Arabic-Indic digits, and invisible marks, and includes `specs.fabricType` plus SKU aliases. The same predicate is used for storefront `search`, only when a search string is present.
7. No `pg_trgm` index and no Meilisearch on this path. The catalog is small; the delay was a request per character plus the variant join. Postgres stays the source of truth when the search engine is down.

## Non-goals

- Replacing the admin table, filters, or Excel export
- Indexing the storefront in Meilisearch as part of this change
- Putting the page number in the URL
