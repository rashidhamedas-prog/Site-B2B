# PR-11 Media validation — file plan (plan only, no code)

Source: `stage2-design.md` §3.6 · §5.6 (`POST /media/scan`) · §6 row PR-11 · `stage1-requirements.md` REQ-M1 · REQ-M2 · `req-technical.md` §3 (SKU 5047 truncated JPEG) · §8#8 · `pr-execution-queue.md` row 11 · GO حامد ۲۹ اکتبر ۲۰۲۶ — **ARCHITECT ONLY**.

Gate: **CODE** · **depends on PR-10 soft** (IA tab mount; media tab can land behind its own flag without settings/templates) · **hard minimum:** upload module EOI helpers already on master · Preferred worktree: `D:/proje/Site-B2B-pr11` (rebase after PR-10 when shared shell conflicts).

## 0. Headline finding

**Upload already rejects truncated JPEGs and can compress to ~1.8 MiB for messenger derivatives; operators still have no omnichannel «سلامت رسانه» scan or pre-queue gate.** `upload-bytes.ts` (`jpegEndsWithEoi`, `rejectTruncatedJpeg`, `assertDecodableImage`) and `channel-image.ts` (`prepareChannelJpeg`, `CHANNEL_PHOTO_MAX_BYTES = 1.8MiB`) cover new uploads and Bale/Telegram prepare paths. Gaps vs stage2 §3.6 / REQ-M1–M2: (1) **no admin scan** of existing product/MinIO assets for corrupt/oversized images (5047 still cited as needing re-upload); (2) **no `POST /omnichannel/media/scan`** or health table UI; (3) publication enqueue can still reference a bad `publicUrl` without a decode/EOI check at compose/deliver time; (4) Persian rejection copy is partial (upload controller) and not surfaced in omnichannel Media tab; (5) open **C5** (1.8 vs 2 MB) — implementer must not invent a third constant. PR-11 is a **delta**: wire validation + one-shot/resumable scan + Media Health UI — **without** vault/egress (PR-12), alerts (PR-13), bots (PR-14), or god-service split (PR-15).

## 1. Invariants (must hold after PR-11)

- **Shared monolith:** Product / Order / Inventory / stock projection unchanged; connectors stay off in CI; **no** `OMNICHANNEL_*` send-enable flags beyond UI/scan feature flags in `.env.example`.
- **No invented limits:** reuse `CHANNEL_PHOTO_MAX_BYTES` (1.8 MiB) as messenger gate; document C5 (1.8 vs 2) as open — do **not** hardcode a new 2 MB path without Owner decision.
- **Secrets:** scan/report never includes tokens, vault ciphertext, or MinIO credentials; object keys only.
- **Performance:** scan is **paginated / chunked** (no full-catalog decode in one request); admin Media tab lazy-loaded; no LCP/storefront impact; Sharp via existing `withSharpSlot` concurrency.
- **Dry-run safe:** scan and validate endpoints **never** call messenger adapters / Bot API.
- **Do not edit:** `apps/web/src/lib/blog.ts`.

## 2. Existing behavior vs stage2 gaps

| Piece | Location | Today | Gap |
| --- | --- | --- | --- |
| Truncated JPEG reject | `upload/upload-bytes.ts` | On upload + storage confirm | Not applied as omnichannel pre-send assert for already-stored URLs |
| Channel compress | `upload/channel-image.ts`, `bale-media.ts`, `telegram-media.ts` | Prepare under 1.8 MiB | No admin «فشرده‌سازی / جایگزینی» workflow |
| Media registry | `omnichannel_media_assets`, `GET/PATCH media` | List + altText | No health columns / scan status |
| Admin UI | `AdminOmnichannel.tsx` media table | Alt only | No §3.6 scan table / replace CTA |
| REQ-M1 Persian error | upload controller | Partial | Omnichannel composer/queue must show same Persian codes |

## 3. Target API (implementer contract)

Prefix: `/v1/omnichannel`. Prefer thin `OmnichannelMediaService` — avoid bloating god-service.

| Method | Path | Role | Purpose |
| --- | --- | --- | --- |
| POST | `media/validate` | PUBLISHER+ | Body `{ url \| storageKey }` → `{ ok, code?, messageFa, bytes?, width?, height? }` — decode + EOI + size vs channel max; **zero** adapter I/O. |
| POST | `media/scan` | OWNER or PUBLISHER (D-2) | Body `{ cursor?, limit? }` → page of findings `{ productId?, sku?, publicUrl, issue: truncated\|undecodable\|oversized\|ok, bytes }` + `nextCursor`. Idempotent; persists last scan summary. |
| GET | `media/health` | VIEWER+ | Last scan summary + top issues (5047-class rows first when present). |
| POST | `media/:id/mark-needs-replace` | PUBLISHER+ | Flag registry row for UI; optional link to product admin (no auto-delete). |

**Enqueue / deliver gate (D-1):** before CREATE outbox claim or at composer confirm, call shared pure `assertChannelPhotoReady(bytes|url)` — on failure set/delivery error `unsupported_media` (non-retryable, existing Q6 behavior) with Persian «اول تصویر را اصلاح کنید».

## 4. Data model

**Prefer additive JSON / columns on `omnichannel_media_assets`** (no messenger schema):

| Change | Notes |
| --- | --- |
| `healthStatus` varchar nullable | `unknown` \| `ok` \| `truncated` \| `undecodable` \| `oversized` \| `needs_replace` |
| `healthCheckedAt` timestamptz nullable | Last scan touch |
| `healthDetail` varchar nullable | Short code; **no** secrets |
| Optional `omnichannel_media_scan_runs` | `{ id, startedAt, finishedAt, scanned, failed, actorId }` — only if summary cannot live in settings JSON |

**Owner:** Postgres backup on Iran before migration. Migration additive + `down()`.

## 5. UI (admin)

| Component | IA | Flag |
| --- | --- | --- |
| `admin-omnichannel-media-health.tsx` | Tab **«۶. رسانه»** — scan button, findings table, «جایگزینی تصویر» deep-link to product media | `OMNICHANNEL_MEDIA_HEALTH_UI` |

- Loading skeleton; empty = «هنوز اسکن نشده».
- Persian issue labels; never show raw stack traces.
- Mount from `AdminOmnichannel.tsx` **thin** — extract media table out of the god component; do not rewrite health/coverage/composer shells owned by other PRs.

## 6. Files to claim (`file_claims`)

Register in `.ai-dos/tasks/active.yaml`: owner, branch `feat/omnichannel-pr11-media-validation`, worktree **`D:/proje/Site-B2B-pr11`**.

| File | Action |
| --- | --- |
| `apps/api/src/modules/omnichannel/media-validation.ts` | NEW — pure decode/EOI/size helpers wrapping upload-bytes + channel-image constants |
| `apps/api/src/modules/omnichannel/media-validation.spec.ts` | NEW — fixture truncated 5 MiB JPEG (5047-class) rejected |
| `apps/api/src/modules/omnichannel/services/omnichannel-media.service.ts` | NEW — validate, scan page, health summary |
| `apps/api/src/modules/omnichannel/services/omnichannel-media.service.spec.ts` | NEW |
| `apps/api/src/modules/omnichannel/dto/omnichannel-media.dto.ts` | NEW |
| `apps/api/src/modules/omnichannel/controllers/omnichannel-admin.controller.ts` | EDIT — routes §3 only (coordinate with other PRs) |
| `apps/api/src/modules/omnichannel/omnichannel.module.ts` | EDIT — register media service |
| `apps/api/src/modules/omnichannel/omnichannel-rbac.ts` | EDIT — scan/validate roles |
| `apps/api/src/modules/omnichannel/entities/omnichannel-media-asset.entity.ts` | EDIT — health columns |
| `apps/api/src/database/migrations/*-omnichannel-media-health.ts` | NEW |
| `apps/api/src/database/migrations/*-omnichannel-media-health.spec.ts` | NEW |
| `apps/api/src/modules/omnichannel/services/omnichannel.service.ts` | EDIT — **minimal**: delegate listMedia/patchAlt or call validate before publish path; prefer moving media list into media service to shrink god-service touch |
| `apps/api/src/modules/upload/upload-bytes.ts` | EDIT — only if shared helper export needed (prefer import-as-is) |
| `apps/api/src/modules/upload/channel-image.ts` | EDIT — only if exporting max-bytes for validation (prefer import constants) |
| `apps/web/src/components/admin/admin-omnichannel-media-health.tsx` | NEW |
| `apps/web/src/components/admin/admin-omnichannel-media-health.spec.ts` | NEW |
| `apps/web/src/components/admin/AdminOmnichannel.tsx` | EDIT — mount tab behind flag; **avoid** colliding with PR-10 settings/templates mounts |
| `apps/web/src/components/admin/admin-omnichannel-ui.tsx` | EDIT — shared Persian media labels if needed |
| `.env.example` | EDIT — `OMNICHANNEL_MEDIA_HEALTH_UI` |
| `apps/api/scripts/unit-specs.txt` | EDIT |
| `docs/WORKLOG.md`, `docs/reports/2026-10-xx-omnichannel-pr11-media-validation.md` | EDIT/NEW |

**Do not touch:** `omnichannel-token-vault*`, `telegram.adapter.ts` / `TELEGRAM_API_URL` / Worker (**PR-12 Telegram non-goals**), `bale.adapter.ts` / `rubika.adapter.ts` send paths (except shared prepare already used), alerts (**PR-13**), bots/webhook (**PR-14**), channel_settings core (**PR-10**), coverage SQL (**PR-8**), composer core (**PR-9** — may call `media/validate` only), god-service split (**PR-15**), SMS / `.tmp-sms-panel/**`, connector enable flags, `docker-compose.yml`, `scripts/auto-deploy.sh`, outbox row DELETE, `apps/web/src/lib/blog.ts`.

## 7. Open decisions (safe defaults)

| # | Question | Recommended default |
| --- | --- | --- |
| D-1 | When to assert media | Composer confirm + worker prepare failure → `unsupported_media` (already non-retryable) |
| D-2 | Who may scan | PUBLISHER+ for scan; VIEWER for health GET |
| D-3 | C5 1.8 vs 2 MB | Keep **1.8 MiB** (`CHANNEL_PHOTO_MAX_BYTES`); document Owner may raise later |
| D-4 | Auto-rewrite storage on scan | **No** — report + mark needs_replace only |
| D-5 | Scan scope | Product primary + gallery URLs referenced by active publications first; then registry rows |
| D-6 | Feature flag default | `OMNICHANNEL_MEDIA_HEALTH_UI=false` until staging |

## 8. Tests required

1. `media-validation.spec.ts` — truncated JPEG (no EOI) → reject; valid small JPEG → ok; oversized after decode path → oversized.
2. `omnichannel-media.service.spec.ts` — scan pagination cursor; no adapter calls.
3. `omnichannel-rbac.spec.ts` — validate/scan roles.
4. Frontend: Media Health shows Persian truncated label; scan button hidden for Viewer.
5. Acceptance (stage2): **5047-class** fixture appears in scan findings / validate rejects; flag off restores legacy media alt table only.

Pass bar: omnichannel + upload unit specs green + `tsc` clean.

## 9. Must-do vs owner-gated

| Must-do | Owner-gated |
| --- | --- |
| Pure validation + scan API + Media Health UI behind flag | Written **GO** before merge/deploy |
| Wire unsupported_media Persian path | Iran DB backup before migration |
| Unit fixtures for truncated JPEG | Enable `OMNICHANNEL_MEDIA_HEALTH_UI` on Iran |
| WORKLOG + report | Confirm C5 if raising cap to 2 MB |
| | No `TARANOM_DEPLOY_FORCE` / `SKIP_DRAIN` |

## 10. Rollback

Set `OMNICHANNEL_MEDIA_HEALTH_UI=false`. Revert PR; health columns unused are harmless. No messenger side effects.

## 11. Non-goals

Vault / egress / `TELEGRAM_API_URL` / Worker domain / moving Telegram token (**PR-12**); unanswered / DEAD alerts (**PR-13**); bots inbound (**PR-14**); inventing chat IDs; enabling connectors; auto mass recompress of catalog; SMS; god-service full split (**PR-15**).

## 12. Sequence / conflicts

0. Soft after PR-10 for cleaner IA tabs; **parallel_prep OK** vs PR-12.
1. Claim media-owned files; **soft-reclaim** only `omnichannel-admin.controller.ts`, `omnichannel.module.ts`, `AdminOmnichannel.tsx`, `omnichannel.service.ts` after prior PR releases.
2. Implement pure validation → service → routes → UI → tests → wait GO.

**Conflict avoid:** do not expand `listMedia` logic inside god-service; extract to `omnichannel-media.service.ts`. Coordinate AdminOmnichannel tab keys with PR-10 (`settings` / `templates`) — use distinct view id `media-health`.
