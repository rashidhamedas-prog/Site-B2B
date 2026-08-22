# Retail home + product-card UI/UX — 2026-08-22

## Benchmark (Iran storefronts)

Reviewed patterns from Digistyle, Banimode, and Modiseh (dominant Iranian women’s fashion e-com), plus boutique D2C habits (image-first tiles, one trust bar, size on PDP).

What those sites do well that Taranom was missing:

| Pattern | Gap on live `.ir` | Fix |
|---|---|---|
| Image-first editorial card, name/price centered | Name and price side-by-side, heavy border, trust icons on every card | Borderless 3:4 card, centered type, no per-card trust |
| Hover second photo; tap still goes to PDP | Second image existed; card was too busy on 2-col mobile | Compact home/category tiles; overlay CTA desktop-only |
| Size chosen on PDP (returns) | Home «افزودن به سبد» with default first size | Home CTA = «انتخاب سایز» → PDP |
| One trust strip under hero | Stats/CTA CMS blocks dropped or ignored | Trust strip after hero; `cta` actually renders |
| Category label visible on touch | «مشاهده مجموعه» hover-only | Always visible on mobile |

## GitHub sources used (not copied)

1. [vercel/commerce](https://github.com/vercel/commerce) — canonical Next.js App Router storefront patterns (image-first card, hover swap, compact home grid).
2. [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) (`web-design-guidelines` + `react-best-practices`) — hover is not a primary action, 44px hits, no extra client islands, no waterfalls.
3. Locked Taranom tokens (`#1B5C4A` / `#C9A84C` / `#F6F1E8`) beat generic Liquid-Glass/pink from ui-ux-pro-max.

No new npm packages. Magic UI was not added (client JS + LCP risk).

## Scope

Retail storefront only. `RetailHeader` untouched (TASK-006). `defaults.ts` untouched (TASK-017) — fallbacks live in `RetailBlocksRenderer`.

## Validation

- `cd apps/web && npx tsc --noEmit` → exit **0**
- `cd apps/web && npm run lint` → exit **0** (`tsc --noEmit`)
- No new dependencies
- `middleware.ts` not staged (TASK-20260822-001)
