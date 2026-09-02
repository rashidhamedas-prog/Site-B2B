# Omnichannel public blog authors require channel — 2026-09-03

Task: TASK-20260826-001  
Branch: `ai/TASK-20260826-001-blog-authors`  
Base: `edd42b4` channel isolation

## CODE

`GET /blog/authors/:slug` requires `channel=RETAIL|WHOLESALE`. Posts are filtered to that channel. Missing/invalid → 400. Author record itself is shared; only the post list is isolated.

Retail page sends `channel=RETAIL`. Wholesale page sends `channel=WHOLESALE`. Did not edit `apps/web/src/lib/blog.ts`.

## Non-goals

Live Telegram, canary send, connector flags, worker leftover apply, create-order session-channel bind, empty auto-publish `*Chosen`.

## Rollback

Revert this commit. No migration.
