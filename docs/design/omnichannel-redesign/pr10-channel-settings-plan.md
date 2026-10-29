# PR-10 Channel settings + Templates — file plan (plan only first; implement in same branch)

Source: `stage2-design.md` §0 D1–D7 · §1 (IA §5 Templates, §9 Channel settings) · §3.5 · §3.10 · §4 (Owner+GO for channel/template activate) · §5.1 `channel_settings` · §6 row PR-10 · `stage1-requirements.md` REQ-C1/C6/C7/C10/C11 · `pr-execution-queue.md` row 10 · constraints: skip **PR-12** (egress/vault); **PR-14 last** (bots); no `TARANOM_DEPLOY_FORCE` / `SKIP_DRAIN`; connectors stay off in CI; **LIVE contact/UTM/ownerChatId values are owner-gated** (safe empty defaults only).

Gate: **CODE** · **depends on PR-9** merged (`composer` may consume showPrice / contact / UTM from destination settings). Soft: PR-8 coverage deep-link unchanged.

## 0. Headline finding

**Automation rules already live per destination; channel *content* identity does not.** Cap/gap/quiet/mode/OOS sit on `destination.publishSettings` with connection/global fallback. Templates are already per-`destinationId` with versions, but there is no typed surface for contactId / botUsername / channelLink / hashtags / CTA / UTM / showPrice / ownerChatId, no «ضدآب» hard guard on save, no Owner+goRef **activate** for a template version, and render still uses a bare PDP URL without per-channel UTM. PR-10 closes that **content delta** without inventing LIVE IDs and without a separate SQL table (D-1).

## 1. Invariants (must hold after PR-10)

- **Shared monolith:** stock/price/inventory unchanged; no connector enable in CI; no Worker/`TELEGRAM_API_URL` / vault (**PR-12**).
- **Per-destination content, no shared fallback (REQ-C10 / D1):** content fields resolve **only** from `destination.publishSettings`. Empty string / false — never copy contact/UTM/ownerChat from connection or global.
- **Safe defaults:** `showPrice=false`; contactId/botUsername/channelLink/hashtags/ctaText/utmSource/utmCampaign/ownerChatId = `''`. **Do not** seed `@TaranomRetailBot`, phone numbers, or real chat ids in code or migrations.
- **LIVE values owner-gated:** PATCH content settings + template **activate** → **OWNER + `goRef`** when `OMNICHANNEL_RBAC_ENABLED=true` (same pattern as publish-settings).
- **«ضدآب» blocked (REQ-C7 / D5):** create/patch template body containing `ضدآب` / `ضد آب` → **400**; live publish caption with same → **400**.
- **minOrder from product (REQ-C1):** `{minOrder}` token reads `product.minOrderQty` only (no hard-coded 6/1 in template defaults beyond product field).
- **Secrets:** never return tokens; ownerChatId is a numeric/string chat id field only — no bot token fields here.
- **Performance:** settings GET is O(1) destination row; template list already scoped; no N+1 product loads beyond existing `publicationVarsFor`.
- **UI flag:** `OMNICHANNEL_CHANNEL_SETTINGS_UI` default **false**; API always registered.

## 2. Existing behavior vs stage2 gaps

### 2.1 What exists

| Piece | Location | Behavior today |
| --- | --- | --- |
| Cap/quiet/mode/OOS | `destination.publishSettings` + `connection-publish-settings.ts` | Per-dest with connection/global fallback |
| Templates | `omnichannel_channel_templates` + `destinationId` | Per-dest create/patch; in-place edit; no activate |
| Render | `publicationPayloadFor` / `publicationVarsFor` | Tokens name/sku/price/url/…; no contactId/minOrder/UTM |
| Admin settings wizard | `AdminOmnichannel.tsx` steps template + rules | Rules only; no content identity form; no claim guard |
| Composer (PR-9) | `composer/plan` | Dry-run; showPrice override not wired to settings yet |

### 2.2 Gaps vs stage2 §3.5 / §3.10 / REQ-C*

| Requirement | Gap |
| --- | --- |
| REQ-C10 content fields per channel | Missing typed keys + UI |
| REQ-C6 UTM on PDP link | URL has no utm_source/campaign from dest |
| REQ-C7 «ضدآب» | Soft warn deferred from PR-9 — hard block missing |
| REQ-C1 `{minOrder}` | Token absent; packQty used instead |
| §3.5 activate Owner+GO | patchTemplate enables without GO |
| §3.10 copy-from-channel | Missing (values only, no shared link) |
| showPrice default off (D4) | Price always rendered if template has price block |
| ownerChatId field | Missing (bot test button deferred to PR-14) |

## 3. Target API (implementer contract)

Prefix: `/v1/omnichannel`. RBAC: PR-6 guards.

| Method | Path | Role | Purpose |
| --- | --- | --- | --- |
| GET | `destinations/:id/channel-settings` | PUBLISHER+ | Returns automation subset + **content** fields (empty defaults). Includes `settingsSource` for automation only; content always `destination`. |
| PATCH | `destinations/:id/channel-settings` | OWNER + goRef | Body: content fields + optional existing automation fields + `reason`. Audit before/after (redacted). |
| POST | `destinations/:id/channel-settings/copy-from` | OWNER + goRef | Body: `{ sourceDestinationId, includeAutomation?: boolean, reason?, goRef }`. Copies **values** into target dest blob; never shares row id. |
| GET | `templates?destinationId=` | VIEWER+ | Unchanged list (ensure still runs). |
| POST | `templates` | PUBLISHER+ | Create new version; reject «ضدآب»; product templates require `destinationId`. |
| PATCH | `templates/:id` | PUBLISHER+ | Edit draft body/enabled=false ok; reject «ضدآب»; enabling via this route **allowed only if already enabled** or when RBAC off — preferred path is activate. |
| POST | `templates/:id/activate` | OWNER + goRef | Enables this version; disables other versions same `(destinationId, eventType)`; audit. |
| POST | `templates/preview` | PUBLISHER+ | Optional thin wrapper: body + sample productId → rendered text (reuse preview). Prefer existing `POST preview` with destinationId. |

**DTO content fields (all optional on PATCH):** `contactId`, `botUsername`, `channelLink`, `hashtags`, `ctaText`, `utmSource`, `utmCampaign`, `showPrice`, `ownerChatId` (+ existing automation keys on same PATCH for one-shot Owner save).

## 4. Data model (migrations)

**D-1 default: no migration.** Store content keys inside existing `ChannelDestination.publishSettings` jsonb (already on destinations since `20261024-001`). Template versioning already on `omnichannel_channel_templates.version`.

Optional later (reject in v1): separate `omnichannel_channel_settings` table — only if jsonb audit/diff becomes painful.

## 5. Render / template contract

- Extend `TEMPLATE_TOKENS` with `minOrder`, `contactId` (and keep `url` as PDP with UTM applied).
- `publicationVarsFor(projection, channelContent?)`:
  - `minOrder` = `String(product.minOrderQty)` when > 0 else `''`
  - `contactId` from channel content
  - `url` = `appendUtm(baseUrl, { utmSource, utmCampaign })` when either set
  - if `showPrice !== true` → clear `price` and `packPrice`
- `assertNoForbiddenProductClaims(text)` used by createTemplate / patchTemplate / live createPublication caption paths.

## 6. UI (admin)

New extract: `admin-omnichannel-channel-settings.tsx` (+ templates panel).

- Nav **«تنظیمات هر کانال»** and **«قالب‌ها»** when `OMNICHANNEL_CHANNEL_SETTINGS_UI=true` (`status.channelSettingsUi`).
- Tabs Telegram / Rubika / Bale (destination select per provider); fields from §3.10; Persian labels; empty placeholders «مالک وارد می‌کند».
- Templates: three-column hint (variables / editor / live preview via `POST preview`); save creates/patches version; **فعال‌سازی** Owner+goRef; copy-from destination.
- Legacy settings wizard steps remain; new tabs are additive behind flag.

## 7. File claims

| Path | Action |
| --- | --- |
| `docs/design/omnichannel-redesign/pr10-channel-settings-plan.md` | ADD |
| `apps/api/src/modules/omnichannel/channel-settings.ts` | ADD — pure parse/merge/guard/UTM/minOrder |
| `apps/api/src/modules/omnichannel/channel-settings.spec.ts` | ADD |
| `apps/api/src/modules/omnichannel/connection-publish-settings.ts` | EDIT — allow content keys in publish blob |
| `apps/api/src/modules/omnichannel/destination-publish-settings.ts` | EDIT — content resolve destination-only |
| `apps/api/src/modules/omnichannel/publication-template.ts` | EDIT — tokens + optional claim scan helper export |
| `apps/api/src/modules/omnichannel/dto/omnichannel.dto.ts` | EDIT |
| `apps/api/src/modules/omnichannel/controllers/omnichannel-admin.controller.ts` | EDIT |
| `apps/api/src/modules/omnichannel/services/omnichannel.service.ts` | EDIT — get/patch/copy/activate + render wire |
| `apps/api/src/modules/omnichannel/omnichannel.constants.ts` | EDIT — UI flag |
| `apps/api/src/modules/omnichannel/omnichannel-rbac.ts` | EDIT — `template_activate`, `channel_settings_*` goRef |
| `apps/api/scripts/unit-specs.txt` | EDIT |
| `apps/web/src/components/admin/admin-omnichannel-channel-settings.tsx` | ADD |
| `apps/web/src/components/admin/admin-omnichannel-channel-settings.spec.ts` | ADD |
| `apps/web/src/components/admin/admin-omnichannel-ui.tsx` | EDIT — `channelSettingsUi` |
| `apps/web/src/components/admin/AdminOmnichannel.tsx` | EDIT — tabs |
| `.env.example` | EDIT |
| `docs/WORKLOG.md` | EDIT |
| `docs/reports/2026-10-28-omnichannel-pr10-channel-settings.md` | ADD |

**Do not touch:** `outbox-worker.service.ts`, adapters, `omnichannel-token-vault*`, Worker/`TELEGRAM_API_URL` (**PR-12**), SMS / `.tmp-sms-panel/**`, bots/webhook (**PR-14**), media scan (**PR-11**), alerts (**PR-13**), god-service split (**PR-15**), `docker-compose.yml`, `scripts/auto-deploy.sh`, connector enable flags, inventing LIVE contact/chat ids.

## 8. Open decisions (safe defaults)

| # | Question | Recommended default |
| --- | --- | --- |
| D-1 | Separate `channel_settings` table | **No** — jsonb on destination |
| D-2 | Seed botUsername `@TaranomRetailBot` | **No** — owner types; UI hint only |
| D-3 | Default UTM values (D12) | **Empty** until owner sets |
| D-4 | showPrice | **false** |
| D-5 | ownerChatId test ping | **Defer PR-14** (field only) |
| D-6 | `OMNICHANNEL_CHANNEL_SETTINGS_UI` | Default **false** |
| D-7 | Publisher may draft templates | **Yes**; activate = Owner+goRef |
| D-8 | Copy includes automation | Opt-in `includeAutomation` default **false** (content only) |

## 9. Tests required

1. `channel-settings.spec.ts` — empty defaults; no invented ids; UTM append; waterproof reject; content isolation (dest A ≠ dest B); showPrice false blanks price.
2. Extend `connection-publish-settings.spec.ts` / destination resolve — content ignores connection fallback.
3. `publication-template.spec.ts` — minOrder/contactId tokens render.
4. Controller/source asserts: activate RequiresGoRef; `channelSettingsUi` flag default off.
5. Frontend `admin-omnichannel-channel-settings.spec.ts` — empty defaults copy; no hard-coded LIVE ids in source.

**Acceptance (stage2 §6):** preview render for a destination equals canary caption structure (same template + settings); «ضدآب» save fails; changing Telegram content does not change Bale content.

## 10. Must-do vs owner-gated

| Must-do (CODE) | Owner-gated |
| --- | --- |
| Pure helpers + APIs + flag-off UI | Fill LIVE contact/UTM/ownerChatId on Iran |
| Waterproof + minOrder + UTM wire | Enable `OMNICHANNEL_CHANNEL_SETTINGS_UI` |
| Activate + copy-from | Activate production template versions |
| WORKLOG + report + PR | Merge/deploy with separate GO; DB backup if any future migration |

## 11. Rollback

Set `OMNICHANNEL_CHANNEL_SETTINGS_UI=false`. Content keys in jsonb are additive and ignored by older readers. Revert PR removes routes; legacy rules PATCH still works.

## 12. Non-goals

**PR-12** egress/vault; **PR-14** bots/inbound/PFI/ownerChat test send; **PR-11** media validation; **PR-13** alerts; **PR-15** god-service split; SMS; FORCE/SKIP_DRAIN; inventing LIVE IDs; minOrderQty data backfill (REQ-C11 data work — warn only); changing claim/cap/quiet logic (**PR-5**).

## 13. Sequence

0. Program: PR-9 → **PR-10** → PR-11 → PR-13 → PR-15 → **PR-14 last**; never PR-12.
1. Plan commit (this file) on `feat/omnichannel-pr10-channel-settings` from `origin/master`.
2. Pure `channel-settings` + tests.
3. Extend publish settings + service/controller + render wire.
4. UI behind flag.
5. Unit specs → WORKLOG/report → push + open PR (no merge/deploy).
