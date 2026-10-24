# Destination-scoped Omnichannel settings isolation (2026-10-24)

## Goal

Operator settings for templates, auto rules, activation, and status/publish/ops tabs must isolate by **destinationId**. Two chats under the same bot must never leak template, mode, or daily cap.

## Grain

| Layer | Key |
|-------|-----|
| Bot credentials | `connectionId` (unchanged) |
| Templates + automation/OOS/cap/gap/quiet/events/categories | **`destinationId`** |
| Worker leftovers (retry SLA / retention) | Global `app_settings.omnichannel` |

## Resolution order

1. `destination.publishSettings` / templates with `destinationId`
2. Connection `publishSettings` / templates with `connectionId` and null destination (compat)
3. Channel-wide template fallback only (`connectionId` + `destinationId` null)

## Schema

Migration `20261024-001-destination-publish-settings.ts`:

- `omnichannel_channel_destinations.publishSettings jsonb NOT NULL DEFAULT '{}'`
- `omnichannel_channel_templates.destinationId uuid NULL` + FK
- Partial uniques: destination / connection-without-dest / channel fallback
- Backfill: copy connection settings → destinations; single-dest attach templates; multi-dest clone

## API

- `GET|PATCH /v1/omnichannel/destinations/:id/publish-settings`
- Product template create requires `destinationId`
- List/status accept `?destinationId=` for scoped metrics/tables
- Preview / create / requeue pass connectionId + destinationId into `publicationPayloadFor`

## Admin UI

`AdminOmnichannel.tsx`: `selectedDestinationId` drives wizard template/rules/activate and filters status/publish/ops. `AdminTelegramTemplateBuilder` remounts with `key={selectedDestinationId}`. Empty state when no destination selected.

## Review follow-ups (closed)

- `PATCH /connections/:id/publish-settings` and `PATCH /settings` with only `connectionId` → **400** (destination required).
- `GET /status?destinationId=` overlays destination `autoDailyCap` / mode (not stale global leftovers).
- `toPublicDestination` strips raw `publishSettings`.
- Admin metrics use `rules.autoDailyCap` for the selected destination.

## Hard stops unchanged

No flip of `OMNICHANNEL_CONNECTORS_ENABLED` / `OMNICHANNEL_AUTO_PUBLISH`. No outbox DELETE. No vault/adapter invent.
