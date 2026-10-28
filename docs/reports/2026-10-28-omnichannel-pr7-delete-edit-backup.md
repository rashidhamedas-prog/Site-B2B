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

## Owner smoke (Iran `5ebb10c8`, 2026-10-28)

Canary-only on Bale **4858359991** (no Telegram/Rubika/live wholesale deletes):

| Step | Evidence |
| --- | --- |
| CREATE | delivery `91b42ea7-…`, `providerMessageId` **284** |
| optional EDIT | HTTP 201 · backup `04a46eb8-…` · UPDATE SUCCEEDED |
| delete-plan | HTTP 200 · `confirmHint=FREE_POST` · within 48h |
| DELETE | delivery `1f3f00a1-…` SUCCEEDED · pre_delete backup `93d942e3-…` · CREATE WITHDRAWN |

Backups before migrate/deploy: `pre-pr7-*`, `pre-pr7b-20261028T131822Z`. Flag `OMNICHANNEL_DELETE_EDIT_ENABLED=true` for smoke.

## Follow-up (this branch)

- Register `OmnichannelPostBackupEntity` + `OmnichannelDeliveryMessageEntity` in `RUNTIME_TYPEORM_ENTITIES` (was hot-patched on Iran only after smoke 500).
- Admin delete drawer: backup preview + step-2 `confirmSku`/`goRef` + always-on Bale 48h copy; `delete-plan` returns `deleteWindowHours`.

## Rollback

Revert merge; leave empty backup tables. Disable flag / connectors to stop remote deletes.
