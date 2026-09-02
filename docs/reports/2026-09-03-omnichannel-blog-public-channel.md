# Omnichannel public blog channel — 2026-09-03

Task: TASK-20260826-001  
Branch: `ai/TASK-20260826-001-blog-channel`  
Base: `b259733` on `ai/TASK-20260826-001-s9-settings`  
Architect: [معمار omnichannel](e459337f-2fc1-4a7a-8191-ce40e63d155f)  
Security (pre-change): [امنیت omnichannel](e3cfb596-f410-4656-ba9d-8f334a03e532) PASS WITH CONDITIONS (blog missing channel)  
Reviewer: [بررسی فاز](086098da-1f98-497f-a2ef-0ba14d1594bd) PASS WITH CONDITIONS  
Security (post-change): [بررسی امنیت](c3f4c2dc-9a5a-4445-9ece-fb4d11791e49) PASS WITH CONDITIONS

## Scope

Require `channel=RETAIL|WHOLESALE` on public blog reads, same contract as products and CMS. Missing/invalid → `PUBLIC_CHANNEL_REQUIRED` / HTTP 400 «کانال نامعتبر است».

Public routes gated: posts, categories, category slug, tags, tag slug, search, feed, sitemap-posts, post SEO, post slug, redirects/match.

Admin blog routes still use `normalizeChannel()` and may omit channel.

## Non-goals

`apps/web/src/lib/blog.ts`, `useSiteChrome`, empty auto-publish allowlist, worker wiring, live Telegram, connector flags, authors/comments/related-products, collections, discount validate.

## Rollback

1. Revert this commit.
2. No migration. Do not DELETE outbox rows.
