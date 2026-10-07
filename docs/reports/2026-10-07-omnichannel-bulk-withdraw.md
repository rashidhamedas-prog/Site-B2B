# Omnichannel publications — bulk / selective withdraw

**Task:** TASK-20261007-004  
**Depth:** full (skill-top + ECC api-design / tdd-workflow)

## Goal

Professional multi-select withdraw on `/admin/omnichannel` «انتشارها», matching the admin orders bulk pattern.

## Changes

| Layer | Change |
| --- | --- |
| API | `POST /v1/omnichannel/publications/bulk-withdraw` — body `{ ids: uuid[], reason? }`, max 100, partial `{ action, results }` |
| API | `normalizeBulkPublicationIds` helper + spec |
| API | `assertNoPlaintextSecrets` on bulk and single withdraw (reason must not look like a token) |
| Web | Row checkboxes, select-all (active only), contextual toolbar, confirm with count |

## Non-goals

- Hard-delete products from catalog
- Enabling connectors / auto-publish
- Pagination redesign

## Validation

```text
cd apps/api
npx ts-node --transpile-only src/modules/omnichannel/bulk-publication-ids.spec.ts
→ bulk-publication-ids.spec.ts: ok
```

Security (same session): auth stack unchanged (JWT + ADMIN + OmnichannelAdminGuard). Cap 100. Secret-shape scan on reason added for withdraw paths.

## Rollback

Revert the listed files; single-row withdraw remains the fallback UX if API bulk route is removed first.
