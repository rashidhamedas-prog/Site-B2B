# Live sales-partner notice admin metrics (2026-10-12)

Task: `TASK-20261012-004` · Depth: skill-top **full**

## Problem

`مخاطب` showed frozen `audienceCount` from publish time (e.g. 25) while the live ACTIVE roster is ~75. Seen/dismissed were already live from receipts.

## Change

### API
- Additive field `activeAudienceCount` on admin list/publish/archive row payloads.
- List shape: `{ items, activeAudienceCount }` so empty history still exposes live roster.
- One `COUNT(profiles WHERE status='ACTIVE')` per call; frozen `audienceCount` unchanged.

### UI (`SpNoticeDesk`)
- Primary triplet **مخاطب** binds to `activeAudienceCount` (live).
- Caption keeps send-time snapshot.
- Section KPIs: همکاران فعال الان / دیدهٔ کل / بسته‌شدهٔ کل.
- Soft refresh: 45s while visible + focus/visibility (min 15s debounce); no skeleton flash on poll.

## Validation

- `sales-partner-notice-metrics.spec.ts`
- `apps/web` tsc
