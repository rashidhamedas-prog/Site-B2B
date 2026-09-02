# Phase order and current evidence

Task: `TASK-20260826-001`. Branch pattern: `ai/TASK-20260826-001-<slug>`.

| Phase | Status on master | Notes |
|---|---|---|
| 0 correctness | CODE shipped | Channel stock, SALE movement, public ACTIVE, CMS sanitize |
| 1 schema | CODE shipped + migrated | 8 omnichannel tables; audit + media additive |
| 2 outbox | CODE shipped | Product writes enqueue; no Meilisearch on request |
| 3 worker | CODE shipped; soak started 2026-09-01T12:22Z | Dual worker; persist/lease fixes merged |
| 4 Retail projection | CODE complete | Feed shares `channelAvailability` (PR #76) |
| 5 Wholesale projection | CODE largely present | Pack MOQ on projection; checkout sends `channel=WHOLESALE` |
| 6 connectors | Gated off | Telegram official API behind flag; Bale/Rubika throw |
| 7 Admin | CODE present | OOS + canary stored (PR #78); no live send |
| 8 hardening | CODE present | DB_SYNC fail-closed; ops scripts; timers in repo |

Owner-gated (not CODE): destination canary send, connector enable, auto-publish enable, independent Security on the live SHA, remaining §9 decisions that change live behavior.
