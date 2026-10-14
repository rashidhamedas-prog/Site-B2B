# Per-connection publish settings (2026-10-14)

## Goal

Every wholesale/retail bot × platform must own its own publish rules and template. No silent sharing of mode, daily cap, gap, quiet hours, events, categories, OOS, withdraw, or layout across bots.

## Grain

`ChannelConnection` already is `(provider, salesChannel, bot name)` → scope = `connectionId`.

## Storage

| Item | Before | After |
|------|--------|-------|
| Automation (mode/cap/gap/quiet/events/categories/withdraw/OOS) | Single `app_settings.omnichannel` blob | `omnichannel_channel_connections.publishSettings` jsonb |
| Product template | provider×channel (Telegram master for all) | Optional `connectionId`; fallback = channel-wide row |
| Canary uniqueness | One per provider×salesChannel | One per connection |
| retry SLA / outbox retention | Global | Still global (worker leftovers) |

## API

- `GET/PATCH /v1/omnichannel/connections/:id/publish-settings`
- `PATCH /v1/omnichannel/settings` — automation/OOS requires `connectionId` (routes to connection); without it only retry/retention

## Migration

`20261014-001-connection-publish-settings.ts`

- Adds `publishSettings`, `templates.connectionId`
- Drops old template unique; adds partial uniques for fallback vs per-bot
- Backfills each connection from legacy global blob (`seeded: false`)

## Verification

- Specs: connection-publish-settings, migration, publication-automation, phase-acceptance, oos-policy, canary-ping
- Phase review: FAIL then fixed (template unique index)
- Security review: PASS WITH CONDITIONS (test coverage residuals only)

## Hard stops unchanged

No flip of `OMNICHANNEL_CONNECTORS_ENABLED` / `OMNICHANNEL_AUTO_PUBLISH` in this change.
