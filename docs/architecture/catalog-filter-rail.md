# Catalog filter rail — wholesale + retail `/products`

Status: implementing (TASK-20260912-003)  
Date: 2026-09-12

## Goals

- Help a wholesale buyer (and the retail shopper) narrow the live catalog by the attributes they already use to decide: fabric, color, size system, availability.
- Keep the filter visible on desktop while scrolling the grid, and usable with one hand on mobile.
- Use one visual shell on `.com` and `.ir` so the two storefronts do not drift.

## Non-goals

- New product API, facet aggregation, or multi-value query params.
- Invented per-option counts (the API does not return facet buckets).
- Changing category landing pages, search, or sort semantics.
- Horizontal filter bars as the primary desktop pattern (Baymard 2025–2026: they do not scale and are easy to miss).

## Confirmed facts

- Wholesale listing UI: `apps/web/src/components/wholesale/ProductCatalog.tsx` (RTL sidebar already first in the flex row → right side).
- Retail listing UI: `apps/web/src/components/retail/RetailProductsCatalog.tsx` (currently a top grid of `<select>`).
- Public `GET /v1/products` already accepts `fabric`, `color`, `size` (`FREE|TWO|THREE` or garment size), `collar`, `collectionId`, `minPrice`, `maxPrice`, `inStock`, `sort`, `search`.
- Filtered `/products?...` stays `noindex,follow` via the `*WithUrl` overlays.
- Storefront listing payloads are slimmed; do not depend on a complete variant set to *build* the filter options.

## Assumptions

- Single-select per facet matches the current API (one `color`, one `fabric`). Multi-select would need an explicit API change.
- Color swatch hex comes from the same named palette as admin color drafts; unknown names fall back to a neutral chip, never a guessed fashion color.
- Wholesale price is often hidden until login; the rail does not add a wholesale price slider.

## Open decisions

- Per-option counts: deferred until a cheap facet endpoint exists.
- Category pages: out of this task; they do not currently have a filter rail.

## Module map

| Piece | Owner | Notes |
| --- | --- | --- |
| Option lists, chips, hex lookup | `apps/web/src/lib/catalog-filter.ts` | Pure, testable |
| Visual rail + chips + mobile drawer | `apps/web/src/components/catalog/` | Shared client island |
| Wholesale wiring + URL | `ProductCatalog` + `WholesaleProductsCatalogWithUrl` | Instant apply on `lg+` |
| Retail wiring + URL | `RetailProductsCatalog` + `RetailProductsCatalogWithUrl` | Same shell; extra collar / collection / price |

## UX contract

| Surface | Pattern | Apply |
| --- | --- | --- |
| Desktop `lg+` | Sticky right rail (RTL), accordion groups, visual swatches | Instant (query updates as the user taps) |
| Mobile | Full-height drawer from the right, sticky footer | Explicit «نمایش نتایج» on a draft copy |
| Results | Dismissible chips above the grid + clear-all | Removing a chip is immediate |

Filter groups (priority): موجودی → پارچه → سایزبندی → رنگ → (retail) قیمت / کالکشن / یقه.

Sort and keyword search stay in the listing toolbar, not inside the facet rail.

## Security / SEO / perf

- No new auth surface. Query strings stay the existing public filters.
- Do not add images or extra fetches to the rail (CSS textures + Lucide only).
- Animate `opacity` / `transform` only; honor `prefers-reduced-motion`.
- One LCP product image rule unchanged; filter UI is not LCP.

## Test / rollout

- Unit: chip labels, active count, color hex fallback, size-type labels.
- `apps/web` `tsc --noEmit`.
- Browser: wholesale `/products` desktop rail + mobile drawer; retail `/products` same shell; empty-filter recovery; chip dismiss; URL still noindexes when filtered.
- Rollback: revert the web files; API unchanged.

## Critical sequence

```
User taps color swatch
  → desktop: parent state + router.replace(?color=) + GET /products?channel=…
  → mobile: draft only until Apply
  → overlay marks robots noindex,follow
  → chips render; empty state offers remove-one / clear-all
```
