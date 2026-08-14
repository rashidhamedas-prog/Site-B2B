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
