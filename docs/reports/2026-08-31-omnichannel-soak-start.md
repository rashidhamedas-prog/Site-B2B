# Omnichannel soak start — 2026-08-31

Live SHA at evidence collection: `6e4167e` (before `worker-b`).

## Proven

- Phase 0–8 **code** shipped (#59) plus worker Redis (#60) and explicit migrations (#62).
- API `/v1/health` 200; `taranom_worker` healthy; eight `omnichannel_*` tables present.
- `OMNICHANNEL_CONNECTORS_ENABLED` / `OMNICHANNEL_AUTO_PUBLISH` unset. Deliveries=0. Connections=0. Publications=0.
- Restore-drill 12:25:24Z: AES dump → disposable `taranom_restore_drill` → destroyed. Refused `taranom_db`.
- Dry-run canary: 10 ACTIVE retail SKUs then 10 wholesale SKUs. Channel stocks differ (e.g. `shomiz-linen-sara` retail 23 / wholesale 6). No destination publish.
- Specs: `omnichannel-phase-acceptance`, `channel-projection`, `channel-stock-isolation` exit 0.

## Soak clock

- Start: 2026-08-31T12:30:00Z
- Required: 24h with two workers leasing empty/outbox via `FOR UPDATE SKIP LOCKED`
- Do not enable connectors or auto-publish during soak

## Still required before Done

- Dual worker live (`worker-b`)
- Alerts timer on VPS
- 24h soak without DEAD/lag
- Retail then Wholesale **destination** canary (needs owner credentials + explicit connector enable)
- Independent Reviewer + Security on this wave
