# Orphan size variants after AUTO → CUSTOM/MANUAL

**Task:** TASK-20261024-002  
**Date:** 2026-10-24  
**Live evidence:** `womens-rhinestone-heeled-shoes`, `womens-miu-miu-style-leather-boots` — `sizeType=CUSTOM`, `pack=MANUAL`, labels `37–40`, but API variants still included `فری سایز`.

## Root cause

1. Category cards (`CategoryProductCard`) listed sizes from **all** `variant.size` rows (`uniqueSizes`), not from the product size chart.
2. Admin `ensureSizeStocks` hid orphans in the editor; `PUT .../color-stock` **upserted** new sizes and never deleted obsolete ones.
3. `PATCH /products/:id` for pack/size fields did not prune variants. TASK-20261020-001 only XOR’d pack composition columns.

## Fix (defense in depth)

| Layer | Change |
|--------|--------|
| Source of truth | `size-chart-variants.ts` — `variantsOnSizeChart` / `orphanSizeVariants` |
| Write | `pruneOrphanSizeVariants` on size-chart update; `setColorStock` chart-only upsert + per-color prune |
| Read | `withBadges` filters variants to chart; web storefront helpers mirror |
| Data | Migration `20261024-002-prune-orphan-size-variants` one-shot DELETE + stock resync |

Historical order lines keep size snapshots (no FK). `defaultRetailVariantId` is `ON DELETE SET NULL`. `erp_variant_map` rows cleared when present.

## Non-goals

- Redesign pack UX
- Soft-delete variants
- Omnichannel connector enablement
