# ADR: Torob Product API-first

- Date: 2026-08-29
- Task: TASK-20260829-001
- Status: accepted

## Decision

Retail catalog exposure to Torob is API-first. PostgreSQL is the only source of truth. A single pure projection builds Product API v3, Torob XML, and PDP fallback metatags. JWT audience is the exact public API host from `TOROB_API_AUDIENCE`. Outbox is not a second catalog.

## Why

Crawler HTML and a static feed cannot stay consistent with live price and `retailStock`. Official v3 lets Torob pull current rows. A shared projector prevents IRR/Toman and stock-channel drift.

## Rollback

1. Do not run the additive migration on production until the owner approves.
2. If migrated: `down()` drops `guarantee` and `defaultRetailVariantId` only.
3. Disable the panel Product API URL and keep XML feed as fallback.
4. Revert the nginx exact location if it causes routing issues.

## Non-goals

- No invented Torob write API
- No production migrate/deploy in this task
- Order-tracking stays a separate endpoint and audience
