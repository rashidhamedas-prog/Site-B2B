# Omnichannel PR-8 — Coverage matrix (2026-10-28)

## Summary

Read-mostly product×channel coverage matrix: pure cell/duplicate/gap helpers, absence-reason table, out-of-panel **audit-only** ingest (Owner+goRef), admin tab «پوشش و تکرار» behind `OMNICHANNEL_COVERAGE_UI` (default **false**). No connector enable, no egress/vault, no bots, no composer (PR-9), no live canary delete.

## Delivered

| Item | Location |
| --- | --- |
| Pure matrix | `apps/api/src/modules/omnichannel/coverage-matrix.ts` (+ spec) |
| Service | `services/omnichannel-coverage.service.ts` (+ spec) |
| Migration | `20261028-004-omnichannel-coverage-absence` (additive) |
| Entity | `entities/omnichannel-coverage-absence.entity.ts` |
| Routes | `GET coverage`, `GET coverage/duplicates`, `GET coverage/:id`, `PUT …/absence-reason`, `POST coverage/out-of-panel/ingest`; audits `?source=` |
| RBAC | coverage GET/PUT → PUBLISHER+; ingest → OWNER + goRef; `coverage_out_of_panel_ingest` in GO list |
| UI | `admin-omnichannel-coverage.tsx` tab when `status.coverageUi` |
| Flag | `OMNICHANNEL_COVERAGE_UI` in `.env.example` (default off) |

## Defaults (open decisions)

- D-1 absence table · D-2 retail ∪ publication history · D-3 Bale link always null · D-4/5/6 audit-only ingest · D-7 UI flag off · D-8 fixed gap presets · D-9 pending ≠ duplicate.

## Tests

- `coverage-matrix.spec.ts`, `omnichannel-coverage.service.spec.ts`, `20261028-004-…spec.ts`, rbac GO assertion, `admin-omnichannel-coverage.spec.ts` (tsx).
- Register in `apps/api/scripts/unit-specs.txt`.

## Residual risks

1. Full-universe build then filter in memory — fine for current catalog size; if products ≫ thousands, move filter into SQL.
2. Out-of-panel flags scan last 500 audit rows — historical Bale ingest (5+11) must be posted after deploy for matrix badges.
3. Acceptance «۹ تکراری بله» needs owner validation on Iran/staging DB after migrate + UI flag.
4. Delete-old deep-link surfaces delete-plan summary only; actual remote delete still Owner+goRef + PR-7 flag.

## Rollback

`OMNICHANNEL_COVERAGE_UI=false` or revert PR. Empty absence table is harmless. No worker change.

## Non-goals held

PR-12 egress/vault · PR-14 bots · FORCE/SKIP_DRAIN · live canary delete · SMS · composer · channel_settings UX · alerts.
