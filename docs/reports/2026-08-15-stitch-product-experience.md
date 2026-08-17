# Stitch product experience — 2026-08-15

## Readiness (Phase 0)

- Workspace: `D:\soft\Claud\porje\Site B2B` (not Site BtoB)
- Branch at start: `ai/TASK-20260812-001-payment-integrations` @ `a3a1767`
- User card/detail diffs preserved and integrated
- No new npm dependency
- Claim note: TASK-006 owns `apps/web/src/app/retail/products/[slug]/page.tsx` — PDP page untouched; work is in `RetailProductDetail`
- TASK-001 owns `docs/WORKLOG.md` / AI-DOS registry — worklog appended because conventions require it

## Missing backend (not invented)

- Ratings / reviews
- Volume-tier wholesale prices
- Separate carton-count field (pack = colors × sizes)

## Gates

| Command | Result |
|---|---|
| `npm run type-check -w @taranom/web` | exit 0 |
| `npx tsx apps/web/src/lib/product-display.spec.ts` | OK |
| `npx tsx apps/web/src/lib/wholesale-order.spec.ts` | OK |
| `npm run build -w @taranom/web` | exit 0; 66 pages |

## Ship

| Step | Result |
|---|---|
| Commit | `332afd4` `feat(web): ship Stitch product experience on retail and wholesale` |
| PR | [#42](https://github.com/rashidhamedas-prog/Site-BtoB/pull/42) merged `2026-08-14T21:13:30Z` |
| `origin/master` | `5880f95` |
| VPS `/opt/taranom` | HEAD `5880f95`; web/api/nginx restarted after merge |
| `https://api.poshaktaranom.com/v1/health` | 200 `{"status":"ok","service":"taranom-api","version":"1.0"}` |
| `https://www.poshaktaranom.com/` | 200; guest price «پس از ورود»; brand `#1B5C4A` |
| `https://www.poshaktaranom.ir/` | 200; retail cards `aria-pressed` + add-to-cart |
| Wholesale PDP `/products/coats00015` | «انتخاب تعداد و سایزبندی» / حداقل سفارش |
| Retail PDP `/products/coats00015` | wishlist `aria-pressed` |
