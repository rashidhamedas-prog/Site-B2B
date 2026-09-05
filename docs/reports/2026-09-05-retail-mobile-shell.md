# Retail mobile shell + PDP description (TASK-20260905-001)

Date: 2026-09-05  
Owner: cursor:implementer-TASK-20260905-001  
Branch: `ai/TASK-20260905-001-retail-mobile-shell`

## Brief

Retail (`.ir`) mobile layouts were collapsing on some pages. Product copy was also hidden in a buy-column accordion instead of sitting under the product like wholesale.

## Root causes (code evidence)

1. **No overflow containment on the retail shell.** `retail-root` / `main` had no `min-width: 0` or `overflow-x: clip`, so one wide child (header wordmark, CMS HTML, 21:9 banner, table) blew the viewport on every page.
2. **Header flex without a shrinking brand.** `POSHAK TARANOM` + `tracking-[0.14em]` + hamburger + three icons exceeds ~360px. That is a global defect, not a page CSS bug.
3. **PDP IA.** `RetailProductDetail` put `fullContent`/`description` inside `<details>` in the sticky buy column. Wholesale `ProductDetail` renders the same copy as a full-width card below the gallery+buy grid.
4. **Category hero `aspect-[21/9]`** on phones is a thin strip (~137px at 320px). Looks broken, not merely small.

## Architecture (what we changed, not page patches)

```
retail-root (overflow-x: clip, min-w-0)
  header  3-zone flex: menu | brand(min-w-0) | actions(ms-auto)
  main    overflow-wrap + prose containment for CMS/blog/tables
  footer
```

PDP:

```
[ gallery | buy/size/price ]     ← no long copy here
[ توضیحات محصول  full width ]   ← same as wholesale, all breakpoints
[ related ]
[ sticky add-to-cart, lg:hidden ]
```

## Files

- `apps/web/src/app/retail/retail.css` — shell containment
- `apps/web/src/app/retail/layout.tsx`
- `apps/web/src/components/retail/RetailHeader.tsx`
- `apps/web/src/components/retail/RetailHero.tsx`
- `apps/web/src/components/retail/RetailProductDetail.tsx`
- `apps/web/src/components/retail/RetailTrustStrip.tsx`
- `apps/web/src/components/category/CategoryLanding.tsx`
- `apps/web/src/lib/retail-pdp-copy.ts` (+ spec)

## Non-goals

Checkout, account, API product projection, middleware, wholesale About CSS-3D.

## Validation

Recorded in handoff after commands run.
