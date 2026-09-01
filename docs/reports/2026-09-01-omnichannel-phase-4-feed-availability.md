# Omnichannel Phase 4 — Feed shares channelAvailability

Date: 2026-09-01  
Task: TASK-20260826-001

## Why

Architect review after Phase 3 drain (`3353266`): Feed still summed `retailStock` privately and fell back to product-level stock when every variant was 0. Basalam already used `channelAvailability(p, 'RETAIL')`.

## Change

`feeds.controller.ts` `loadRows()` uses the shared resolver. Isolation spec pins the import. `feeds.controller.ts` reclaimed from TASK-20260829-001 (stale heartbeat 2026-08-30).

## Non-goals

Connectors stay off. No destination canary. No §9 guesses.
