# Omnichannel PR-11 — Media validation (2026-10-29)

**GO حامد ۲۹ اکتبر ۲۰۲۶** — implement + open PR (no merge/deploy).

## Summary

Operators can validate and chunk-scan registry media for truncated JPEG (5047-class), undecodable, or oversized (> `CHANNEL_PHOTO_MAX_BYTES` = 1.8 MiB) images without messenger egress. Live `createPublication` asserts photos before outbox enqueue (`unsupported_media`). Admin tab «رسانه» is behind `OMNICHANNEL_MEDIA_HEALTH_UI` (default off).

## Delivered

| Area | Detail |
| --- | --- |
| Pure helpers | `media-validation.ts` — EOI/decode/size; Persian messages aligned with upload |
| Service | `OmnichannelMediaService` — validate / scan / health / mark-needs-replace / publish gate |
| API | `POST media/validate`, `POST media/scan`, `GET media/health`, `POST media/:id/mark-needs-replace` |
| Data | Additive `healthStatus` / `healthCheckedAt` / `healthDetail` on `omnichannel_media_assets` (`20261029-001`) |
| UI | `admin-omnichannel-media-health.tsx` tab `media-health`; Viewer hides scan |
| Flag | `OMNICHANNEL_MEDIA_HEALTH_UI=false` in `.env.example` |

## Specs run

- `media-validation.spec.ts`
- `omnichannel-media.service.spec.ts`
- `20261029-001-omnichannel-media-health.spec.ts`
- `omnichannel-rbac.spec.ts`
- `omnichannel-phase-acceptance.spec.ts`
- `admin-omnichannel-media-health.spec.ts`
- `apps/api` + `apps/web` `tsc --noEmit`

## Hard stops honored

No `OMNICHANNEL_CONNECTORS_ENABLED` / `OMNICHANNEL_AUTO_PUBLISH` flips; no Telegram/Bale/Rubika send; no vault/SMS; no invent IDs; no FORCE; no live mass publish; god-service only thin listMedia delegate + publish gate.

## Risks / follow-ups

- **Migration:** Iran Postgres backup before apply (`scripts/backup-postgres.sh`).
- **C5:** Cap stays 1.8 MiB; Owner may raise later — do not invent a second constant.
- **Scan I/O:** Chunked registry reads via MinIO; large catalogs need repeated scan pages.
- **Enable UI:** Staging first with `OMNICHANNEL_MEDIA_HEALTH_UI=true`.
- Merge/deploy only with separate GO حامد.

## Rollback

Set `OMNICHANNEL_MEDIA_HEALTH_UI=false`. Revert PR; unused health columns are harmless. No messenger side effects.

## Plan

`docs/design/omnichannel-redesign/pr11-media-validation-plan.md`
