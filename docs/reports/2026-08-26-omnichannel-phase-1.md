# Omnichannel Phase 1 — schema and contracts

Date: 2026-08-26  
Task: TASK-20260826-001  
Branch: `ai/TASK-20260826-001-omnichannel-phase-0`

## Scope

Additive TypeORM schema only. Connectors and auto-publish stay off. No safety-net SQL.

## Tables

- `omnichannel_channel_connections` — unique `(provider, channel, name)`, `secretRef` only
- `omnichannel_channel_destinations` — FK to connections, unique `(connectionId, destinationKey)`
- `omnichannel_channel_templates` — unique `(provider, channel, eventType, version)`
- `omnichannel_outbox_events` — unique `dedupeKey`; indexes on `(status, availableAt)` and aggregate
- `omnichannel_publications` — unique `(sourceType, sourceId, channel, sourceUpdatedAt)`
- `omnichannel_publication_deliveries` — FKs to publication/destination/event; unique `(eventId, destinationId, action)`

## Runtime

- `OmnichannelModule` registered on `AppModule`
- Admin routes under `/v1/omnichannel/*` require ADMIN
- `POST .../test|preview|publications|retry|withdraw|reconcile` return 409 disabled
- Telegram/Bale/Rubika adapters throw `ConnectorDisabledError`

## Tests

- `20260826-001-omnichannel-schema.spec.ts` — up/down SQL, uniques, FKs, no secret columns
- `omnichannel-secrets.spec.ts` — plaintext rejected; connectors disabled by default
