# Omnichannel PR-13 — Unanswered message alert (REQ-O4 slice)

**GO حامد ۲۹ اکتبر ۲۰۲۶** — implement + open PR (no merge/deploy).

## Scope

- Additive tables: `omnichannel_bot_conversations`, `omnichannel_bot_messages`, `omnichannel_alerts`
- Pure policy `evaluateUnansweredAlerts` (60s default; `OMNICHANNEL_UNANSWERED_THRESHOLD_SEC`)
- Scanner on worker tick (rate-limited); panel `GET/POST alerts` (VIEWER list, PUBLISHER ack/resolve)
- UI tab «هشدارها» behind `OMNICHANNEL_UNANSWERED_ALERTS_UI` (default off)
- `ownerChatId` read via `ownerChatIdForDestination` (PR-10 field shape); empty → panel-only
- Telegram owner notify deferred; BALE/RUBIKA notify only when connectors already LIVE + Owner-entered id

## Hard stops held

- No invented chat IDs / no FORCE / no SMS / no Telegram egress / bots stay OFF / no connector enable
- No PR-14 inbound webhook; seed is service-method for tests only

## Dependency note

- Hard dep PR-10 (#142) merged to master before PR open; branch rebased onto that commit. Added `ownerChatIdForDestination` onto PR-10 `channel-settings.ts`.

## Rollback

Flags off → UI hidden; scanner no-ops on empty tables. Reverse migration only if empty + Owner GO.
