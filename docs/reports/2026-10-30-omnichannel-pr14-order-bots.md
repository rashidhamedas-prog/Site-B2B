# Omnichannel PR-14 — Order bots (CODE, flags OFF)

**Date:** 2026-10-30  
**Branch:** `ai/TASK-20261029-pr14-order-bots`  
**Base:** `origin/master` ≥ `ab4019b0` (tip included `#148`)  
**GO:** حامد ۲۹ اکتبر ۲۰۲۶ §4 — implement CODE with bots default OFF; no merge/deploy by agent.

## Delivered

- Migration `20261030-001-omnichannel-order-bots` — ALTER PR-13 `omnichannel_bot_conversations` / `_messages` (FSM state/tags/order links + idempotency unique).
- Pure units: idempotency, rate-limit, sensitive classifier, FSM (MOQ + sensitive), catalog (no legacy stock write), PFI payload builders, `orderBotEnabled` default false.
- Services: inbound (Bale webhook secret-validated; Telegram stub OFF; Rubika ingest), inbox (list/reply/refer/mark-answered/enable/test-owner-chat), poller (no-op when disabled).
- Admin routes under `/v1/omnichannel/bots/inbox*` + `PATCH connections/:id/order-bot` + `POST …/test-owner-chat`.
- Public webhooks: `POST /v1/omnichannel/bots/bale/webhook`, `…/telegram/webhook` (Telegram flag OFF; no Worker/TELEGRAM_API_URL change).
- UI: «صندوق ربات‌ها» behind `OMNICHANNEL_ORDER_BOT_UI=false`; channel-settings «تست آی‌دی مقصد» wired.

## Hard stops held

- No `OMNICHANNEL_CONNECTORS_ENABLED` / `OMNICHANNEL_AUTO_PUBLISH` flip.
- No Telegram egress / vault Telegram / Worker change.
- No canary clear/remap of Bale `4858359991`.
- No invented destination/chat IDs; no SMS; no FORCE/SKIP_DRAIN; no outbox DELETE.
- All `OMNICHANNEL_ORDER_BOT_*` default false.

## Rollback

1. Keep/set all order-bot env flags false; Owner PATCH `orderBotEnabled=false`.
2. Stop poller; optional documented deleteWebhook if was registered.
3. Revert PR; additive columns may remain or `down()`.

## Next (Owner)

- Iran backup → migrate `20261030-001` after tip with PR-13 tables.
- Brief Bale canary smoke only with written GO; cancel test PFI; leave bots OFF.
- Merge/deploy requires separate GO.
