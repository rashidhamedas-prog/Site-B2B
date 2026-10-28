# Omnichannel PR-8 — Coverage matrix (2026-10-28)

## Summary

Read-mostly product×channel coverage matrix: SQL-paged `GET /v1/omnichannel/coverage`, duplicates export, absence-reason table, manual out-of-panel audit ingest (Owner+goRef). Admin tab «پوشش و تکرار» behind `OMNICHANNEL_COVERAGE_UI` (default **false**). Live message IDs prefer PR-7 `omnichannel_delivery_messages` when present.

## RBAC

| Path | Role |
| --- | --- |
| GET coverage / duplicates / :productId / audits?source= | VIEWER+ |
| PUT absence-reason | PUBLISHER+ |
| POST out-of-panel/ingest | OWNER + goRef |

## Migrations

- `apps/api/src/database/migrations/20261028-004-omnichannel-coverage-absence.ts` (additive)
- Iran apply only after owner GO + listable Postgres dump

## Review fixes (pre-push)

1. SQL-level `LIMIT/OFFSET` product paging + summary over the **same** filtered universe (no full-catalog in-memory build+filter+slice).
2. `listDuplicates` selects duplicate pairs in SQL (hard cap 1000) then hydrates only those products.
3. Out-of-panel ingest stores `productId` in audit payload; flag loader queries by `entityId` / `payload.productId` for the page ids (no last-500 global scan).
4. Trail message IDs prefer `omnichannel_delivery_messages` (`deletedAt IS NULL`).

## Non-goals

PR-12 egress/vault, PR-14 bots, live channel scrape, FORCE/SKIP_DRAIN, connector enable, mass DEAD retry.

## Rollback

Revert PR or keep `OMNICHANNEL_COVERAGE_UI=false`. Empty absence table is harmless.
