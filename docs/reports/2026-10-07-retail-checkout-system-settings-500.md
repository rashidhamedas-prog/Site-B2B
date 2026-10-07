# Retail checkout 500 — `system_settings`

**Task:** TASK-20261007-008  
**Live symptom:** `poshaktaranom.ir/checkout` pay button shows English `Internal server error`.

## Root cause

`OrderService.resolveSalesPartnerLink` (commit `89d5c331`, 2026-10-04) queried `system_settings` for `salesPartners` on **every** retail `POST /orders`. The real table is `app_settings`. Production has no `system_settings`. Postgres raised `relation "system_settings" does not exist`; Nest mapped it to HTTP 500 `Internal server error`. The query sat **outside** the existing SQL soft-fail catch.

Gateway start never ran. No order row was written.

## Evidence

- API stack 2026-10-07 11:12–11:16 UTC: `create` → `resolveSalesPartnerLink` → missing relation.
- Nginx: three `POST /api/v1/orders` 500s from checkout (32.5M تومان / مشهد).
- Zero retail orders created after 2026-10-04 10:02 until this fix.

## Fix

- Shared SQL helper reads `app_settings` / key `salesPartners`.
- Settings gate uses `resolveSalesPartnerSettings` (same LIVE/CANARY/OFF rules as the program).
- Missing table / legacy `system_settings` / partner-table errors return `null` (DIRECT checkout) instead of 500.

## Spec

`apps/api/src/modules/sales-partner/sales-partner-checkout-link.spec.ts`
