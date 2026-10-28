# Omnichannel PR-7 — Delete/Edit + backup (2026-10-28)

## Summary

Additive `omnichannel_post_backups` + `omnichannel_delivery_messages`, admin delete-plan / messages-delete / edit / revert, withdraw unified with backup-before-DELETE, delivery status `WITHDRAWN` after successful remote delete. Feature flag `OMNICHANNEL_DELETE_EDIT_ENABLED` defaults **off**.

## Depends on

- **PR-6 #129** for full Viewer/Publisher/Owner decorator matrix. This PR still enforces Owner+`goRef` when `OMNICHANNEL_RBAC_ENABLED=true` and honors `actor.omnichannelRole` when present. Rebase onto master after #129 merges.

## Migrations

- `apps/api/src/database/migrations/20261028-003-omnichannel-post-backup.ts`
- **Before apply on Iran:** `scripts/backup-postgres.sh` and record dump path here (owner).

## Non-goals

PR-12 egress/vault, PR-8 UI, PR-14 bots, FORCE/SKIP_DRAIN, live canary delete in CI, SMS.

## Owner smoke (later)

One delete only on Bale chat **4858359991**. Then optionally set `OMNICHANNEL_DELETE_EDIT_ENABLED=true`.

## Rollback

Revert merge; leave empty backup tables. Disable flag / connectors to stop remote deletes.
