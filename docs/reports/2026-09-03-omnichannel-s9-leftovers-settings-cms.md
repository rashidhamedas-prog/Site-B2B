# Omnichannel §9 leftovers + public CMS channel — 2026-09-03

Task: TASK-20260826-001  
Branch: `ai/TASK-20260826-001-s9-settings`  
Architect: [معمار omnichannel](470d8572-5705-4d11-8d30-67e124f4006a)  
Security (pre-change): [امنیت omnichannel](0ee84d2a-eb35-4e6a-b64f-0f006b493771) PASS WITH CONDITIONS (CMS default WHOLESALE)

## Scope

Store remaining §9 leftovers in the same `app_settings.omnichannel` blob as OOS. Require `channel` on public CMS reads. Connectors stay off.

| Leftover | Storage | Live apply |
|---|---|---|
| Auto-publish event allowlist | `autoPublishEventTypes` + `*Chosen` | Inert until chosen **and** owner flag |
| Retry SLA seconds | `retrySlaSeconds` + `*Chosen` | Unchosen keeps 3600s cap; not wired to worker |
| Outbox retention days | `outboxRetentionDays` + `*Chosen` | Unchosen starts no job; never deletes PENDING/PROCESSING |
| CMS public routes | `requirePublicCmsChannel` | Missing/invalid → `PUBLIC_CHANNEL_REQUIRED` / HTTP 400 |

## Non-goals

Live Telegram, `OMNICHANNEL_CONNECTORS_ENABLED`, `OMNICHANNEL_AUTO_PUBLISH`, destination canary send, outbox DELETE, blog public default (not this leftover).

## Rollback

1. Revert this commit.
2. Optional: strip leftover keys from `app_settings` where `key=omnichannel`.
3. Do not DELETE outbox rows.
