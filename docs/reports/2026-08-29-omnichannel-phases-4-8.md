# Omnichannel Phases 4–8 — 2026-08-29

Source: `OMNICHANNEL-INFRASTRUCTURE-RETAIL-WHOLESALE.md`. No production migrate/deploy in this session.

## Phase 4 Retail projection

- Shared builder `buildChannelProjection` + Admin `POST /omnichannel/preview`.
- `.ir` URL, retail price/stock/content, `orderType=RETAIL_WEBSITE`.
- `showOnRetail=false` / non-ACTIVE → `publishable=false`.
- Default `dryRun=true`; live canary cap 10 READY/PUBLISHED/PARTIAL.
- Worker consumes catalog outbox (`product.created` and channel-scoped content/price/visibility/media/withdrawn/stock) and upserts/withdraws local publication rows only. Connectors stay off; no Telegram send from this path.
- Feed / storefront / projection share `channelAvailability`.
- Wholesale price/stock change does not emit a RETAIL `product.price_changed` (`product-outbox.spec.ts`).

## Phase 5 Wholesale projection

- Same builder with `WHOLESALE`, `.com` URL, pack MOQ preserved.
- Hidden wholesale is not publishable.
- Wholesale checkout posts `channel=WHOLESALE` and `type=WHOLESALE`.
- Canary cap 10 for wholesale live rows.

## Phase 6 Connectors

- Telegram uses official `api.telegram.org` (`getMe` / `sendMessage` / `editMessageText` / `deleteMessage`) only when `OMNICHANNEL_CONNECTORS_ENABLED=true`.
- Bale and Rubika always throw `ConnectorDisabledError` (no invented API).
- Contract classification: 401, 429, 5xx, timeout, duplicate. Token leak detector in spec.
- `secretRef` remains an env name only.

## Phase 7 Admin / audit / reconcile

- `/admin/omnichannel` connections (Telegram + secretRef), destinations, templates, preview, draft publish, withdraw, reconcile, delivery history + retry with reason, outbox lag, audit actor/reason.
- `GET /omnichannel/outbox` omits payload; `GET /omnichannel/audits` omits payload.
- JWT role is not enough: `OmnichannelAdminGuard` reloads ADMIN from `users`.
- Manual publish/retry/withdraw/reconcile write `omnichannel_audits` (additive migration, not run in production this session).
- Reconcile creates/withdraws publication rows only; `deliveriesCreated=0`. Replay intents are empty.
- Media delete blocked when product/CMS still references the URL.
- Shared `omnichannel_media_assets` registry: upload upserts a row (alt default empty); Admin `GET/PATCH /omnichannel/media` edits alt. Register/list swallow missing-table (`42P01`) until migrate. Successful object delete also removes matching registry rows (fail-closed unless the table is absent).
- Product Admin list shows `channel:status` publication badges (`GET /omnichannel/publications`). Color-stock save no longer writes legacy `stock`.
- Blog/CMS projection: `buildBlogProjection` / `buildCmsProjection`; preview and worker consume `blog.published` / `cms.published` without deliveries. Cross-channel blog/CMS is `channel_mismatch`.

## Phase 8 Deploy hardening

- Production `DB_SYNC=true` throws at TypeORM config; synchronize is false in production.
- GitHub deploy and timer share `scripts/auto-deploy.sh` flock `/tmp/taranom-autodeploy.lock`.
- Safety-net SQL removed from the deploy path; schema is migrations only.
- API image runs as non-root `taranom`, has healthcheck, compose mem/log limits.
- `scripts/omnichannel-ops.sh` writes AES-256 backups (`BACKUP_PASSPHRASE`), refuses production restore, and alerts on DEAD/lag. Restore drill is disposable-only.
- systemd units in `deploy/systemd/` (`omnichannel-ops-alerts.timer` every 15m, `omnichannel-ops-backup.timer` daily). Not installed on the VPS this session.
- `scripts/omnichannel-migrations-disposable-updown.sh` for empty-DB up/down/up of the two omnichannel migrations. Not run against production.

## Security follow-up (2026-08-29)

Independent Security [بررسی امنیت](f3b677bf-61d6-48c8-9edb-0a02cc8168e3) was PASS WITH CONDITIONS. Closed in code:

- SEC-001 `secretRef` / `resolveTelegramToken` allowlist
- SEC-002 classified Telegram errors + worker/admin redaction
- SEC-003 live token shape in jsonb; destination settings stripped from GET
- SEC-004 storage object-key allowlist
- SEC-005 restore-drill also refuses `taranom_db`
- SEC-006 storefront `channel=` findOne/slug hides non-ACTIVE (admin UUID without channel unchanged)

Open: live migrate/deploy/soak/canary. Connectors stay off. SEC-007 coded (variant/color-stock/createVariant → Inventory ADJUST). Worker consumes `product.stock_changed` as search reindex only. Compose MinIO pinned to `minio/minio:RELEASE.2025-09-07T16-13-09Z` and `minio/mc:RELEASE.2025-08-13T08-35-41Z`.

## Validation this session

Recorded after commands run (see handoff). Production migrate and live auto-publish remain off.
