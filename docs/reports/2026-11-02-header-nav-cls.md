# 2026-11-02 — Wholesale chrome CLS = 0 (TASK-20261102-header-nav-cls)

GO: Hamed 1405/08/11. Branch `fix/TASK-20261102-header-nav-cls`.

## Diagnosis on production (master f6af40a7, real data)

Playwright Chromium, `layout-shift` observer with `sources`, load + 2.5s + full scroll.

| Page | 390 | 1440 | Source |
| --- | --- | --- | --- |
| `/` | 0.006778 | 0.001574 | FloatingContact (`div.fixed.left-6`) + footer `p` (+ nav at 1440) |
| `/about` | 0.000050 | 0.000573 | nav (1440), footer `p` |
| `/category/autumn` | 0.000050 | 0.000558 | nav (1440), footer `p` |

1. **Header nav** — `nav.hidden.items-center.gap-0.5.lg:flex` moved x 404→370 (~2.2s). With JS off the category slot (`div.hidden.lg:block`) is 0px wide; with JS on it is 100px. The slot is a streamed `<Suspense fallback={null}>`, so when React reveals it the `justify-between` row redistributes and MegaNav shifts. Without JS the category menu never appeared at all.
2. **FloatingContact** — on `/` the boutique bar sets `--wholesale-bottom-bar`, and the dock used it in `bottom`, so the fixed button jumped 76px (no user input → counted).
3. **Enamad seal** — `<img width=72 height=72 style="height:auto">` for a 125×136 logo; it grew to 78px on load and nudged the centered footer text by 3px.

## Fix

- `WholesaleCategoryNavFallback`: same classes/label as the `<summary>` trigger, as a link to `/products`. Used as the Suspense fallback and when the category list is empty. Suspense kept (header not blocked on the categories fetch, as asserted by `category-storefront.spec.mts`).
- FloatingContact: fixed `bottom`, lift via `transform: translateY(-var(--wholesale-bottom-bar))` with a 300ms transition (reduced-motion: none).
- EnamadSeal: height attribute and `aspect-ratio` 125/136 + `object-fit: contain`.

## Verification

- Local standalone build against the production API (read-only): `/`, `/about`, `/category/fotr` = 0 at 390 and 1440; production master on `/category/fotr` @1440 still 0.000558 from the nav.
- New `e2e/header-nav-cls.spec.ts` (mock API, Chromium): 6/6 total CLS = 0.
- `tsc --noEmit`, `npm run build`, `category-storefront.spec.mts` OK.
- Production after deploy: see WORKLOG / PR.
