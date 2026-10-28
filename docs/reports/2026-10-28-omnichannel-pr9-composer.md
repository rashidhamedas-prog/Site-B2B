# Omnichannel PR-9 Composer (2026-10-28)

## Summary

7-step Composer wizard + dry-run plan API that surfaces CREATE/UPDATE/SKIP from `liveRemoteMessages` **without** adapter/Bot API calls. UI behind `OMNICHANNEL_COMPOSER_UI` (default **false**). No migration (D-1). No PR-12 egress/vault, no bots, no live mass send.

## Delivered

- Pure `composer-plan.ts` + unit spec (dedupe, quiet now, multi-dest).
- `OmnichannelComposerService`: `GET composer/products` (channel required, ≤20), `POST composer/plan` (always dry).
- `createPublication` extended: `destinationIds[]`, `sendMode`/`scheduledAt`, caption overrides; dry-run loads liveRemote and returns `plan`.
- Admin tab «انتشار جدید» + coverage «انتشار جدا» deep-link when flag on.
- Flags in `.env.example`: `OMNICHANNEL_COMPOSER_UI`, `OMNICHANNEL_COMPOSER_STRICT_DESTINATIONS`.

## Hard stops held

- No `OMNICHANNEL_CONNECTORS_ENABLED` / `OMNICHANNEL_AUTO_PUBLISH` flip.
- No Telegram/Bale/Rubika live send in this PR; canary smoke Bale `4858359991` owner-gated later.
- No `TARANOM_DEPLOY_FORCE` / `SKIP_DRAIN`; no merge/deploy by implementer.

## Rollback

Set `OMNICHANNEL_COMPOSER_UI=false` (and optionally `OMNICHANNEL_COMPOSER_STRICT_DESTINATIONS=false`). Legacy publish form remains.

## Migration

**No** — schedule uses outbox `availableAt` only.
