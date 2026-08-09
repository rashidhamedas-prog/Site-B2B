# Architecture

## System boundaries

- **One core monorepo**, two storefront channels, shared inventory/admin (per `docs/B2C.md`).
- Wholesale UI: `apps/web/src/app/(wholesale)/` on `poshaktaranom.com`.
- Retail UI: `apps/web/src/app/retail/` on `poshaktaranom.ir` (local preview `/retail`; host rewrite via middleware).
- Customer portal: `apps/web/src/app/portal/`; Admin: `apps/web/src/app/admin/`.
- API: NestJS under `apps/api` — products, orders, payments, inventory, settings, blog, auth, etc.
- Data: PostgreSQL (TypeORM entities/migrations); Redis; Meilisearch; MinIO object storage.
- Edge: nginx reverse proxy (`nginx/`), TLS, channel/host routing.

## Components and data flow

```
Browser (.com / .ir)
  → nginx
  → Next.js web (channel-aware pages)
  → NestJS API (/v1/*)
  → PostgreSQL / Redis / Meilisearch / MinIO
  → Payment/webhook adapters (server-authoritative totals)
```

Channel differentiation: pricing (`retailPrice` / `wholesalePrice`), stock fields, menus/settings by `WHOLESALE|RETAIL`, order types (e.g. `RETAIL_WEBSITE`), auth paths (retail OTP account vs wholesale portal).

## Invariants and constraints

- Preserve production data, public URLs/SEO, and integrations.
- Server recalculates price, inventory, payable amounts — never trust client totals.
- No website-builder / multi-tenant runtime / page-builder in this program.
- High-risk changes require independent Reviewer + Security when triggers apply.
- Primary git branch is **`master`** (not `main`).

## Architecture decisions

| Date | Decision | Notes |
|------|----------|-------|
| 2026-08-09 | Smallest compatible evolution of existing stack | Retain Next/Nest/PG; no greenfield rewrite (MASTER + file 02) |
| 2026-08-09 | Phase-1 claims = governance + required docs only | Expand `file_claims` before any `apps/*` edit |
| preexisting | Dual-channel single core | Documented in `docs/B2C.md`; verify gaps in audit |
