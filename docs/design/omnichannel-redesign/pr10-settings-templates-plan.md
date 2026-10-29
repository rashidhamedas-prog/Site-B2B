# PR-10 Channel settings + Templates — file plan (plan only, no code)

Source: `stage2-design.md` §0 · §3.5 · §3.10 · §4 (Owner + GO on LIVE/HOLD/template activate) · §5.1 (`channel_settings`) · §6 row PR-10 · `stage1-requirements.md` · `req-technical.md` §8 · `pr-execution-queue.md` row 10 · GO package **continue-119-to-end** (2026-10-28): `00-CURSOR-MASTER-PROMPT.md` · `.ai-dos/tasks/handoff.md` — **skip PR-12** (egress/vault/Worker domain/`TELEGRAM_API_URL`); **PR-14 bots/inbox last** after PR-8–11, PR-13, PR-15; **no** `TARANOM_DEPLOY_FORCE` / `SKIP_DRAIN`; live ops smoke **Bale canary chat `4858359991` only**; **Postgres backup on Iran before every migration** (record path e.g. `/opt/taranom/backups/postgres/YYYYMMDDTHHMMSSZ`).

Gate: **CODE** · **depends on PR-9 merged (soft)** — composer consumes per-destination price toggle defaults and template render; **hard minimum PR-6 + PR-7** (RBAC Owner/`goRef`, audit). **Preferred worktree:** `D:/proje/Site-B2B-pr9` (rebase after PR-9 branch lands). **Soft prep** allowed: pure `channel-settings.ts` + `template-claim-guard.ts` + UI skeleton behind flag without worker/adapters/connector flags.

## 0. Headline finding

**Destination-scoped publish rules and templates exist in DB/API, but stage2 «تنظیمات هر کانال» and «ویرایشگر قالب» are still embedded in monolithic setup wizard.** `ChannelDestination.publishSettings` + `destination-publish-settings.ts` resolve automation (mode, cap, gap, quiet) with optional global fallback; `omnichannel_channel_templates` already versions per `destinationId`. Gaps: (1) **no first-class `channel_settings`** for contactId, channelLink, UTM, showPrice default, ownerChatId, hashtags/CTA — operators mix connection vs destination scope in `AdminOmnichannel.tsx`; (2) **template editor** lacks stage2 three-column layout, multi-channel live preview, **«ضدآب» block**, and explicit **Owner + `goRef` activation** for LIVE policy fields; (3) **`emergencyHold` is read-only stub** in health (`pr1-health-plan.md`) — no Owner write path for per-destination emergency stop; (4) **Publisher can PATCH templates** (PR-6) but stage2 separates «save version» (Publisher + audit) vs «activate LIVE / emergency mode» (Owner + GO); (5) **quiet_hours** and other defer reasons still show raw keys in admin when PR-5 deferred web labels to PR-10. PR-10 is a **product + schema delta**: extend destination settings model, tighten validation/audit, extract settings + templates IA tabs, wire health emergency display to real hold state — **without** composer rewrite (PR-9), media scan (PR-11), egress (PR-12), alerts (PR-13), bots (PR-14), or god-service split (PR-15).

## 1. Invariants (must hold after PR-10)

- **Shared monolith:** Product, Order, Inventory, stock projection unchanged; connectors stay off in CI; **no new `OMNICHANNEL_*` send enable flags** beyond documented UI feature flags in `.env.example`.
- **Per-destination isolation (stage2 D1):** `channel_settings` + active product template + automation cap/quiet/mode resolve **per `destinationId`**; «کپی از کانال دیگر» copies values only — **no shared pointer** between destinations.
- **No global fallback for operator-facing channel copy:** after PR-10, admin GET for channel settings returns resolved values for display but PATCH targets **destination row only**; global `app_settings.omnichannel` remains worker leftovers + legacy seed only (unchanged worker read path).
- **Secrets:** contactId / ownerChatId / URLs validated; never tokens; audit before/after redacts secret-shaped strings (`assertNoPlaintextSecrets`).
- **RBAC (PR-6):** Publisher may save template **draft versions** and run **canary preview** (dry render); Owner + non-empty **`goRef`** required for: `autoPublishMode` → LIVE, emergency hold ON/OFF, template **`enabled: true`** promotion when it changes live caption policy, PATCH channel_settings fields marked policy-tier (mode, cap, quiet, showPrice default).
- **Claim guard (D5):** template body containing **«ضدآب»** (normalized Persian variants) → **400** on save/activate — server-side, not UI-only.
- **minOrder:** template render uses **`product.minOrderQty` only**; UI warns when value is 1 and product not confirmed (stage2 §3.5) — no hardcoded wholesale minimum in template engine.
- **Preview = render canary:** `POST templates/preview` / settings preview uses **`publication-template.ts`** + fixture or selected product; **zero adapter I/O** unless Owner runs existing test-post on canary destination (Bale **`4858359991`** only for live smoke).
- **Dry-run default:** preview endpoints never enqueue outbox.
- **Performance:** settings/templates tabs lazy-loaded; no refetch all templates on every keystroke; debounce preview 300ms; wizard extraction must not regress home/admin bundle — split components with dynamic import.

## 2. Existing behavior vs stage2 gaps

### 2.1 What exists

| Piece | Location | Behavior today |
| --- | --- | --- |
| Publish automation | `connection-publish-settings.ts`, `destination-publish-settings.ts`, `oos-policy.ts` | mode, cap, gap, quiet, withdraw, OOS on connection/dest JSON |
| Templates | `channel-template.entity.ts`, `publication-template.ts` | Versioned `body` per destination; `enabled` flag |
| Admin setup wizard | `AdminOmnichannel.tsx` | Steps bot → channels → template → rules → activate; single large file |
| Settings PATCH | `PATCH destinations/:id/publish-settings`, `PATCH settings` | Owner + goRef when RBAC on; limited field set |
| Health emergency | `omnichannel-health.ts` | `emergencyHold: false` always (PR-1) |
| RBAC | `omnichannel-rbac.ts` | Template CRUD → PUBLISHER; publish-settings → OWNER |
| Composer price toggle | PR-9 plan | Per-send override; default from channel still missing |

### 2.2 Gaps vs stage2 §3.5 / §3.10 / §4 / §5.1

| Requirement | Gap |
| --- | --- |
| §3.10 per-channel form (contact, bot name, link, UTM, owner_chat_id, cap/quiet/mode) | Partially in publishSettings; marketing/contact fields absent or on connection |
| §3.5 template editor (3-col, 3-channel preview, ضدآب, activate Owner) | Inline panel; no claim guard; activation conflated with save |
| §4 HOLD/LIVE / template active Owner + GO | Mode patch exists; emergency hold not wired; template enable not GO-gated |
| `channel_settings` in §5.1 | Not a named schema; fallback still visible in UI |
| REQ-C11 minOrder from product | Render exists; editor warning missing |
| showPrice default off (D4) | Not stored per destination |
| Persian labels for cap/quiet defer reasons | Deferred from PR-5 |
| IA tabs «۵. قالب‌ها» + «۹. تنظیمات هر کانال» | Buried under «تنظیمات» view |

## 3. Target API (implementer contract)

Prefix: `/v1/omnichannel`. Extend existing routes; avoid parallel settings APIs.

### 3.1 Channel settings (per destination)

| Method | Path | Role | Purpose |
| --- | --- | --- | --- |
| GET | `destinations/:id/channel-settings` | VIEWER+ | Returns **`ChannelSettingsPublic`**: contactId, botUsername, channelLink, hashtags, ctaText, utmSource, utmCampaign, showPriceDefault, ownerChatId, automation slice (mode, cap, gap, quiet Tehran labels), settingsSource, templateActiveVersion, emergencyHold. |
| PATCH | `destinations/:id/channel-settings` | Split body | **Publisher tier:** contactId, botUsername, channelLink, hashtags, ctaText, utm* (audit `channel_settings_content_patch`). **Owner + `goRef` tier:** showPriceDefault, autoPublishMode, autoDailyCap, autoMinGapSeconds, quietStartHour, quietEndHour, emergencyHold, ownerChatId (audit with before/after). |
| POST | `destinations/:id/channel-settings/copy-from` | OWNER + `goRef` | Body: `{ sourceDestinationId }` — deep-copy channel_settings + optional template body clone as **new version** (not shared row). |

Validation: `@username` / URL patterns; hours 0–23; cap/gap bounds from constants; `assertNoPlaintextSecrets` on all strings.

**Storage (D-1 default):** extend `channel_destinations.publishSettings` JSON with nested `channelSettings: { … }` + top-level automation keys migrated in place — single column, additive keys only. Alternative rejected: new table until cross-destination queries needed.

### 3.2 Templates

| Method | Path | Role | Purpose |
| --- | --- | --- | --- |
| GET | `destinations/:id/templates` | VIEWER+ | List versions for `eventType=PRODUCT` (+ channel from destination). |
| POST | `templates` | PUBLISHER | Create new version (destinationId required when strict flag on); runs **claim guard**; audit `template_create`. |
| PATCH | `templates/:id` | PUBLISHER | Edit body/options of **draft** or create new version if active (immutable active body — D-3). |
| POST | `templates/:id/activate` | OWNER + `goRef` | Sets `enabled=true` on target version, disables sibling versions same (destinationId, eventType); audit `template_activate`. |
| POST | `templates/preview` | PUBLISHER+ | Body: `{ destinationId, templateBody?, productId?, channel }` → `{ renderedByProvider[], warnings[] }` using catalog projection. |

**Strict destination templates:** when `OMNICHANNEL_SETTINGS_STRICT_DESTINATION=true` (default with PR-10 flag), reject template create without `destinationId`.

### 3.3 Health / emergency hold

| Method | Path | Role | Purpose |
| --- | --- | --- | --- |
| PATCH | `destinations/:id/emergency-hold` | OWNER + `goRef` | Body: `{ hold: boolean, reason }` → persists on destination settings; health card reads real state per provider/destination. |

Worker behavior: emergency hold = treat as **automation gate block** at claim (reuse `evaluateAutomationGate` / mode !== LIVE path) — **no new worker file** if mode patch suffices (D-4).

## 4. Data model (migrations)

**Additive migration** e.g. `202610xx-005-omnichannel-channel-settings.ts` — **owner backup on Iran before apply**.

| Change | Notes |
| --- | --- |
| Optional column `channelSettings` jsonb on `omnichannel_channel_destinations` | **Only if** nesting inside `publishSettings` hits size/merge conflicts (D-1: prefer nested in existing JSON) |
| Backfill script (idempotent) | Copy connection-level marketing fields from `verifyDestination` snapshot into destination `channelSettings` where empty |
| Template `enabled` partial unique | Ensure at most one `enabled=true` per `(destinationId, eventType)` — DB index if not already enforced in service |

**No** outbox/worker schema change unless emergency hold needs indexed column (default: JSON flag read at claim time).

## 5. UI (admin)

Extract from `AdminOmnichannel.tsx` (keep shell thin):

| Component | IA (stage2 §1) | Flag |
| --- | --- | --- |
| `admin-omnichannel-channel-settings.tsx` | Tab **«تنظیمات کانال»** — sub-tabs Telegram / Rubika / Bale / canary mapped from destinations list | `OMNICHANNEL_CHANNEL_SETTINGS_UI` |
| `admin-omnichannel-templates.tsx` | Tab **«قالب‌ها»** — §3.5 three-column editor + per-provider preview cards | `OMNICHANNEL_TEMPLATES_UI` |

**Channel settings UX (§3.10):** one form per selected destination; fields table from stage2; Tehran time on quiet hours; mode switch «LIVE / توقف اضطراری» Owner-only with reason + goRef modal; «تست owner_chat_id» button **disabled** with tooltip «PR-14» until bots land; «کپی از کانال دیگر» Owner flow.

**Templates UX (§3.5):** variable chips `{name}`, `{sku}`, `{minOrder}`, `{price?}`, `{pdpUrl}`, `{contactId}`; live preview calls `templates/preview`; save → new version; **فعال‌سازی** separate button (Owner); block ضدآب with Persian error; minOrder warning banner; parse mode test via canary preview only.

**Labels:** map defer/hold reason keys (`quiet_hours`, `daily_cap`, …) to Persian in shared `admin-omnichannel-reason-labels.ts` (used by queue/status too).

**Legacy:** when flags false, existing setup wizard steps remain.

**Do not edit:** `apps/web/src/lib/blog.ts` (TASK-20260831-003).

## 6. Files to claim (implementer)

Register in `.ai-dos/tasks/active.yaml`: owner, branch `feat/omnichannel-pr10-settings-templates`, worktree **`D:/proje/Site-B2B-pr9`**.

| File | Action |
| --- | --- |
| `modules/omnichannel/channel-settings.ts` | NEW — parse/merge/public/validate; copy-from helper |
| `modules/omnichannel/channel-settings.spec.ts` | NEW |
| `modules/omnichannel/template-claim-guard.ts` | NEW — ضدآب + max body length |
| `modules/omnichannel/template-claim-guard.spec.ts` | NEW |
| `modules/omnichannel/destination-publish-settings.ts` | EDIT — integrate channelSettings; reduce global_fallback in public DTO when strict |
| `modules/omnichannel/oos-policy.ts` | EDIT — only if emergency hold affects automation read |
| `modules/omnichannel/services/omnichannel-settings.service.ts` | NEW — channel-settings CRUD, copy-from, emergency hold |
| `modules/omnichannel/services/omnichannel-settings.service.spec.ts` | NEW |
| `modules/omnichannel/services/omnichannel.service.ts` | EDIT — template activate, preview orchestration; audit before/after |
| `modules/omnichannel/services/omnichannel-health.ts` | EDIT — real `emergencyHold` from destinations aggregate |
| `modules/omnichannel/dto/omnichannel.dto.ts` | EDIT — ChannelSettings DTOs, activate/preview bodies |
| `modules/omnichannel/controllers/omnichannel-admin.controller.ts` | EDIT — routes §3 |
| `modules/omnichannel/omnichannel-rbac.ts` | EDIT — activate, emergency-hold, Owner-tier PATCH classes |
| `modules/omnichannel/omnichannel.module.ts` | EDIT — register settings service |
| `database/migrations/*-omnichannel-channel-settings.ts` | NEW — if D-1 column split chosen |
| `database/migrations/*-omnichannel-channel-settings.spec.ts` | NEW |
| `apps/web/src/components/admin/admin-omnichannel-channel-settings.tsx` | NEW |
| `apps/web/src/components/admin/admin-omnichannel-channel-settings.spec.ts` | NEW |
| `apps/web/src/components/admin/admin-omnichannel-templates.tsx` | NEW |
| `apps/web/src/components/admin/admin-omnichannel-templates.spec.ts` | NEW |
| `apps/web/src/components/admin/admin-omnichannel-reason-labels.ts` | NEW |
| `apps/web/src/components/admin/admin-omnichannel-ui.tsx` | EDIT — Persian reason labels |
| `apps/web/src/components/admin/AdminOmnichannel.tsx` | EDIT — mount tabs; shrink legacy wizard when flags on |
| `apps/web/src/components/admin/admin-omnichannel-composer.tsx` | EDIT — read `showPriceDefault` from channel-settings GET (PR-9 integration) |
| `.env.example` | EDIT — `OMNICHANNEL_CHANNEL_SETTINGS_UI`, `OMNICHANNEL_TEMPLATES_UI`, `OMNICHANNEL_SETTINGS_STRICT_DESTINATION` |
| `scripts/unit-specs.txt` | EDIT |
| `docs/WORKLOG.md`, `docs/reports/2026-10-xx-omnichannel-pr10-settings-templates.md` | EDIT/NEW |

**Do not touch:** `outbox-worker.service.ts` (except import/type if emergency gate shared — prefer pure fn in existing automation), `telegram.adapter.ts`, `bale.adapter.ts`, `rubika.adapter.ts`, `omnichannel-token-vault*`, Worker/`TELEGRAM_API_URL` (**PR-12**), SMS / `.tmp-sms-panel/**`, media scan (**PR-11**), coverage matrix SQL (**PR-8**), composer plan core (**PR-9** — consume settings API only), alerts (**PR-13**), god-service split (**PR-15**), bots/webhook (**PR-14**), `docker-compose.yml`, `scripts/auto-deploy.sh`, connector enable flags in CI, delete/edit backup (**PR-7**), outbox row DELETE, idempotency/HOLD/cap claim logic (**PR-3–5**).

## 7. Open decisions (safe defaults)

| # | Question | Recommended default |
| --- | --- | --- |
| D-1 | Storage for channel_settings | Nested in `publishSettings.channelSettings` + existing automation keys |
| D-2 | Connection vs destination PATCH | **Destination-only** for operator UI; connection publish-settings PATCH deprecated in UI (API kept for compat) |
| D-3 | Edit active template body | **New version** on save; PATCH active body forbidden — activate picks version |
| D-4 | Emergency hold vs mode HOLD | `emergencyHold` boolean blocks automation; distinct from `autoPublishMode` enum — both surfaced in UI |
| D-5 | ضدآب variants | Block substring `ضدآب` case-insensitive + common half-space variants |
| D-6 | UTM defaults (D12) | Empty until owner fills; preview uses destination utm when set |
| D-7 | showPriceDefault | **false** per destination |
| D-8 | Feature flags | Both UI flags default **false** until staging validation |
| D-9 | OWNER allowlist UI | Defer role assignment UI to PR-10 only if PR-6 env allowlist insufficient — read-only display of current omnichannel role |

## 8. Tests required

Unit (`scripts/unit-specs.txt`):

1. `channel-settings.spec.ts` — merge, validation, copy-from isolation (no shared ids).
2. `template-claim-guard.spec.ts` — rejects ضدآب; accepts normal copy.
3. `omnichannel-settings.service.spec.ts` — Owner tier requires goRef; Publisher cannot set mode LIVE.
4. `omnichannel-rbac.spec.ts` — `templates/:id/activate` → OWNER+goRef; preview → PUBLISHER.
5. `omnichannel-health.spec.ts` — emergencyHold true when destination flagged.
6. Extend `publication-template.spec.ts` — preview uses contactId from channel settings fixture.

Integration (Postgres disposable):

7. PATCH channel-settings → audit row with redacted before/after.
8. Activate template v2 disables v1 enabled flag at most one true per destination.

Frontend:

9. `admin-omnichannel-templates.spec.ts` — activate button hidden for Publisher; ضدآب error.
10. `admin-omnichannel-channel-settings.spec.ts` — emergency hold requires goRef field.

**Acceptance (stage2 §6 / continue-119):**

- Preview/template render for three providers from **one** product fixture — **zero** outbound messenger calls.
- Owner activates template on Bale canary destination tied to **`4858359991`**; optional existing test-post only (no mass LIVE).
- `emergencyHold` on health reflects destination switch after Owner PATCH.
- Composer (PR-9) picks up `showPriceDefault=false` for new sessions.
- Revert: both UI flags false restores monolith wizard.

Pass bar: omnichannel unit specs green + `tsc` clean.

## 9. Must-do vs owner-gated

| Must-do (implementer, after PR-9 on master) | Owner-gated |
| --- | --- |
| Pure channel-settings + claim guard + API | Written **GO** before merge/deploy |
| Settings + templates tabs behind flags | **DB backup** on Iran before migration |
| Template activate + emergency hold Owner/`goRef` | Enable flags on Iran staging/production |
| Audit before/after on Owner-tier patches | Hamed enters real contactId / UTM / owner_chat_id values |
| Persian defer reason labels in admin | One Bale **`4858359991`** canary preview/test-post smoke |
| Health emergencyHold wired | Confirm D-12 UTM campaign values |
| WORKLOG + session report | PR-6 OWNER allowlist verification for activate |
| Wire composer `showPriceDefault` | No `TARANOM_DEPLOY_FORCE` / `SKIP_DRAIN` |

## 10. Rollback

Set `OMNICHANNEL_CHANNEL_SETTINGS_UI=false` and `OMNICHANNEL_TEMPLATES_UI=false`. Revert PR; nested JSON keys harmless if unused. Template versions remain in DB; re-activate previous version via SQL/service if needed. Emergency hold OFF via PATCH or revert.

## 11. Non-goals

Telegram **egress** / Worker custom domain / `TELEGRAM_API_URL` / `TELEGRAM_MEDIA_UPLOAD_MODE` (**PR-12**); **token vault** / `OMNICHANNEL_VAULT_KEY`; **PR-14** bots/inbound/webhook/PFI/inbox (owner_chat test button stub only); **PR-11** media decode/scan/compress; **PR-13** alerts including coverage gap automation; **PR-15** god-service refactor; **PR-9** composer wizard implementation (integrate defaults only); **PR-8** coverage matrix; **PR-7** delete/edit; SMS / `.tmp-sms-panel/**`; enabling connectors in CI; changing idempotency/HOLD/cap claim (**PR-3–5**); outbox row DELETE; mass requeue behavior; **`TARANOM_DEPLOY_FORCE` / `SKIP_DRAIN`**; live sends outside Bale canary **`4858359991`**; blog author `channel=` slice; **`apps/web/src/lib/blog.ts`**; inventing Bale/Rubika/Instagram APIs.

## 12. Sequence

0. **Program order (continue-119):** PR-7 → PR-8 → PR-9 → **PR-10** → PR-11 → PR-13 → PR-15 → **PR-14 last**; **never** PR-12 egress/vault.
1. Rebase worktree **`D:/proje/Site-B2B-pr9`** on master with **PR-9** merged.
2. Implement `channel-settings.ts`, `template-claim-guard.ts` + tests (parallel_prep OK).
3. Settings service + controller routes + RBAC splits + health emergency read.
4. Migration/backfill if D-1 requires — **backup first**.
5. Admin tabs + reason labels + composer default hook.
6. Unit/integration → report + WORKLOG → **wait for GO** → deploy Iran per runbook.
