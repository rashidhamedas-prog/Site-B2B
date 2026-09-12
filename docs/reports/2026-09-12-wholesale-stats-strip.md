# Wholesale stats rail — 2026-09-12

## Goal

Replace the tall, empty number band under the wholesale hero with a compact proof rail. CMS numbers stay the source of truth. Height is about half of `py-12 / py-14`.

## Architecture

- **Presentation only.** No API, schema, or pricing change.
- **Data owner:** CMS `stats.items` (`value`, `label`, `sublabel`, optional `icon`) via `/admin/site-content`.
- **Kind resolver:** `resolveWholesaleStatKind` maps label/icon → `customers | years | models | team | default`.
- **Glyphs:** inline isometric SVG in `WholesaleStatGlyph`. No image requests, no client JS.
- **Retail:** `RetailTrustStrip` untouched.

## Performance

- Server component, inline SVG, `transform`/`opacity` only, `prefers-reduced-motion`.
- No LCP image, no extra font, no count-up hydration.

## Validation

- `npx tsc --noEmit` in `apps/web` → 0
- `node --experimental-strip-types src/lib/wholesale-stat-kind.spec.mts` → ok
