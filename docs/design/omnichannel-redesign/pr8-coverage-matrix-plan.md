# PR-8 Coverage matrix — file plan (plan only, no code)

Source: `stage2-design.md` §1 (IA §3) · §2 (OUT-OF-PANEL) · §3.3 · §5.6 · §6 row PR-8 · `stage1-requirements.md` REQ-E3 · REQ-E4 · REQ-E5 · `req-technical.md` §8#2 · `pr-execution-queue.md` row 8 · constraints: skip **PR-12** (egress/vault/Worker domain); **PR-14 last** (bots/inbound); no `TARANOM_DEPLOY_FORCE` / `SKIP_DRAIN`; connectors stay off in CI; canary Bale **4858359991** only for any live reconcile smoke.

Gate: **CODE** · **depends on PR-7** merged (backup + `delivery_message` helper + delete-plan routes for «حذف نسخه‌های قدیمی» deep-link). **Soft prep** allowed in parallel (pure coverage fold/duplicate fns + UI skeleton behind flag).

## 0. Headline finding

**Live-post truth already exists in pure code; operators have no product×channel view.** `liveRemoteMessages` + `foldLiveRemoteMessages` (`publication-automation.ts`) collapse delivery history to **one live messenger post per destination** per product channel. Idempotency/supersede (PR-3) marks extra CREATE rows `superseded_duplicate`, but **historical duplicates** (stage2 acceptance: **۹ محصول تکراری بله**) and **cross-channel gaps** (روبیکا هست / بله نیست) are invisible in `AdminOmnichannel.tsx`. PR-6 added `omnichannel_audits.source` (`panel` | `out_of_panel`) but **deferred ingest to PR-8**. PR-8 is a **read-mostly delta**: server-side coverage aggregation, optional absence-reason storage, manual out-of-panel reconcile ingest, admin matrix UI + filters — **without** composer (PR-9), channel settings (PR-10), alerts (PR-13), egress (PR-12), or bots (PR-14).

## 1. Invariants (must hold after PR-8)

- **Shared monolith:** stock/price/inventory unchanged; no connector enable in CI; no new env send flags.
- **Read path default:** coverage APIs are **PUBLISHER+** read; mutating paths (absence reason, out-of-panel ingest) **PUBLISHER+** with audit; bulk delete from matrix remains **OWNER + `goRef`** via PR-7 routes (PR-8 only links).
- **Secrets:** matrix never returns tokens, bot URLs with secrets, or full connection payloads; message links only whitelisted patterns (see D-3).
- **Tehran time:** all displayed timestamps `Asia/Tehran` (reuse existing format helpers).
- **Duplicate definition (REQ-E4):** for `sourceType=PRODUCT`, count **active** CREATE deliveries: `action='CREATE'`, `status='SUCCEEDED'`, `supersededAt IS NULL`, publication not `WITHDRAWN`, `providerMessageId` present — **per `(sourceId, destinationId)`**; `liveCount > 1` ⇒ cell **duplicate** (red), list all messageIds.
- **Live cell (REQ-E3):** when `liveCount === 1`, cell shows status SUCCEEDED (or WITHDRAWN-at-publication if PR-7 marks publication only), `sentAt`/`updatedAt`, parsed messageIds (from PR-7 `delivery_message` rows or CSV split fallback), optional link field.
- **Missing channel:** empty cell = not live on that destination; distinguish «never published» vs «deleted remotely» using latest DELETE success vs no CREATE success (pure helper, no provider fetch in v1).
- **Out-of-panel (REQ-E5):** rows ingested with `audit.source='out_of_panel'` surface in matrix/audit filter; **no automatic channel polling** in PR-8 (manual ingest only).
- **Performance:** matrix query paginated; default page size **50** products; no N+1 product image fetches — batch product ids; avoid loading full delivery bodies; target p95 API **< 800ms** on Iran for default filters (index-friendly SQL).

## 2. Existing behavior vs stage2 gaps

### 2.1 What exists

| Piece | Location | Behavior today |
| --- | --- | --- |
| Live fold | `publication-automation.ts` — `foldLiveRemoteMessages` | One live CREATE per destination from trail |
| Per-product live | `omnichannel.service.ts` — `liveRemoteMessages` | Loads all publication deliveries for PRODUCT×channel |
| Dedupe / supersede | `outbox.service.ts`, partial unique index | Extra CREATE → `superseded_duplicate` |
| Audit source column | PR-6 `omnichannel_audits.source` | Default `panel`; ingest not built |
| Admin shell | `AdminOmnichannel.tsx` + health extract | Queue/status; **no** coverage tab |
| Delete old posts | PR-7 `delete-plan` + message delete | Callable when PR-7 merged |

### 2.2 Gaps vs REQ-E3 / E4 / E5 / stage2 §3.3

| Requirement | Gap |
| --- | --- |
| REQ-E3 matrix product×channel | No API/UI |
| REQ-E4 duplicate visibility + link to delete | No duplicate counter; no matrix drill-down |
| REQ-E5 out-of-panel reconcile | No ingest; no OUT-OF-PANEL cell state |
| «دلیل عدم‌پوشش» | No persistence |
| Summary «روبیکا ۳۰ · بله ۲۴ · اختلاف m» | No aggregate endpoint |
| Filters (gap, duplicate, out-of-panel, no reason) | Missing |
| `GET /coverage` (§5.6) | Missing |
| `GET /audit?source=out_of_panel` | Filter may exist post-PR-6 — wire list + matrix badge |

## 3. Target API (implementer contract)

Prefix: `/v1/omnichannel` (`omnichannel-admin.controller.ts`). RBAC: **PR-6** guards.

| Method | Path | Role | Purpose |
| --- | --- | --- | --- |
| GET | `coverage` | PUBLISHER+ | Query: `page`, `limit`, `q` (sku/name), `filter` (`all` \| `duplicate` \| `gap_rubika_not_bale` \| `gap_bale_not_rubika` \| `out_of_panel` \| `missing_reason`), `channel` optional. Returns summary counts + rows `{ productId, sku, name, thumbnailUrl?, cells: Record<destinationId, CoverageCell>, flags: { duplicate, outOfPanel, missingReason } }`. |
| GET | `coverage/:productId` | PUBLISHER+ | Detail: all destinations for one product + delivery trail summary (ids, statuses, duplicate list). |
| GET | `coverage/duplicates` | PUBLISHER+ | Flat list of `{ productId, sku, destinationId, channel, messageIds[], count }` for export/owner review (powers «۹ بله» acceptance). |
| PUT | `coverage/:productId/absence-reason` | PUBLISHER+ | Body: `{ destinationId?, reason }` — per-cell or row-wide default; audit `coverage_absence_reason_set`. |
| POST | `coverage/out-of-panel/ingest` | OWNER + `goRef` | Body: `{ events: [{ channel, destinationId?, providerMessageId, action: 'CREATE'\|'DELETE', occurredAt, note? }] }` — writes **audit** rows `source=out_of_panel`, optional stub linkage; idempotent on `(channel, messageId, action, occurredAt)` hash. **No** delivery row mutation in v1 unless owner confirms D-6. |
| GET | `audits` | PUBLISHER+ | Extend/list filter `source=out_of_panel` (if not already exposed). |

**CoverageCell** (DTO): `{ state: 'live' \| 'none' \| 'withdrawn' \| 'out_of_panel' \| 'pending', liveCount, messageIds[], sentAtTehran?, link?, duplicateOf?: uuid[], absenceReason? }`.

**Link rule (D-3):** Telegram/Rubika — show `t.me/...` / rubika patterns only if stored on delivery metadata or template; Bale — default **no link** (`link: null`, show messageId) until owner confirms `ble.ir` format.

## 4. Data model (migrations)

Additive only; **no backup required** for nullable new table (owner GO still required for deploy).

### 4.1 `omnichannel_coverage_absence` (recommended)

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `productId` | uuid FK → products | |
| `destinationId` | uuid nullable | null = applies to all destinations for product |
| `reason` | text NOT NULL | max 500 chars |
| `actorId` | uuid | |
| `createdAt` / `updatedAt` | timestamptz | |

Unique partial: `(productId, destinationId)` where destinationId not null; one row-wide `(productId)` where destinationId null. **Alternative (D-1):** JSON map on `omnichannel_publications` — reject (harder to filter «بدون دلیل»).

### 4.2 Out-of-panel

**Default (D-6):** audit-only ingest — no `omnichannel_out_of_panel_events` table until volume proves need. Optional materialized view later (PR-15).

## 5. UI (admin)

New extract (keep `AdminOmnichannel.tsx` thin): `admin-omnichannel-coverage.tsx`.

- Nav tab **«پوشش و تکرار»** (stage2 §1).
- Header summary from `GET coverage` aggregates.
- Table: rows products, columns fixed order **Telegram / Rubika / Bale** (map from destinations with `channel` enum); sticky SKU column; RTL.
- Cell rendering: status chip colors align §2 visual language; duplicate badge **count** red when `liveCount > 1`; OUT-OF-PANEL ⛔ from ingest flag.
- Filters toolbar (stage2 §3.3).
- Row actions: **«ثبت دلیل»** modal → PUT absence-reason; **«انتشار جدا»** → navigate to existing publish UI with `?productId=` (full composer wizard **PR-9** — button may be disabled with tooltip until PR-9); **«حذف نسخه‌های قدیمی»** → PR-7 delete-plan for selected delivery when duplicates.
- Loading skeleton; API error → grey «نامعلوم» (never fake green).
- Feature flag **`OMNICHANNEL_COVERAGE_UI`** default **false** in `.env.example`; enable on staging after API lands.

**Do not** split full IA rewrite (PR-9/10) — one tab behind flag is enough.

## 6. Files to claim (implementer)

Register in `.ai-dos/tasks/active.yaml`: owner, branch `feat/omnichannel-pr8-coverage`, worktree, list below. **Start after PR-7 on master.**

| File | Action |
| --- | --- |
| `modules/omnichannel/coverage-matrix.ts` | NEW — pure: build cells, duplicate counts, gap filters, link guard |
| `modules/omnichannel/coverage-matrix.spec.ts` | NEW — fold + duplicate fixtures (incl. 2× CREATE same dest) |
| `modules/omnichannel/services/omnichannel-coverage.service.ts` | NEW — SQL aggregation, pagination |
| `modules/omnichannel/services/omnichannel-coverage.service.spec.ts` | NEW — mock repo tests |
| `modules/omnichannel/controllers/omnichannel-admin.controller.ts` | EDIT — routes §3 |
| `modules/omnichannel/omnichannel.module.ts` | EDIT — register service |
| `modules/omnichannel/entities/omnichannel-coverage-absence.entity.ts` | NEW |
| `database/migrations/*-omnichannel-coverage-absence.ts` | NEW — additive |
| `modules/omnichannel/omnichannel-rbac.ts` | EDIT — route classes for coverage + ingest |
| `apps/web/src/components/admin/admin-omnichannel-coverage.tsx` | NEW |
| `apps/web/src/components/admin/admin-omnichannel-coverage.spec.ts` | NEW — static/markup tests |
| `apps/web/src/components/admin/AdminOmnichannel.tsx` | EDIT — tab + flag mount |
| `scripts/unit-specs.txt` | EDIT |
| `docs/WORKLOG.md`, `docs/reports/2026-10-xx-omnichannel-pr8-coverage.md` | EDIT/NEW |

**Do not touch:** `outbox-worker.service.ts`, adapters, `omnichannel-token-vault*`, Worker/`TELEGRAM_API_URL` (**PR-12**), SMS / `.tmp-sms-panel/**`, composer wizard (**PR-9**), channel_settings UX (**PR-10**), media scan (**PR-11**), alerts (**PR-13**), god-service split (**PR-15**), bots/webhook (**PR-14**), `docker-compose.yml`, `scripts/auto-deploy.sh`, connector enable flags, `apps/web/src/lib/blog.ts`, delete/edit **implementation** beyond linking (owned by PR-7).

## 7. Open decisions (safe defaults)

| # | Question | Recommended default |
| --- | --- | --- |
| D-1 | Absence reason storage | Table `omnichannel_coverage_absence` (§4.1) |
| D-2 | Product universe for matrix | Products with `showOnRetail=true` **OR** any omnichannel publication history — union, dedupe; cap scan with pagination |
| D-3 | Bale post links | **No link** in UI/API until owner documents valid `ble.ir` pattern; show messageId |
| D-4 | Provider reconcile | **No** live channel scrape; DB + manual out-of-panel ingest only |
| D-5 | Ingest out-of-panel | Audit append + matrix flag; **do not** auto-create deliveries |
| D-6 | Materialized out-of-panel table | **Defer**; audit-only |
| D-7 | `OMNICHANNEL_COVERAGE_UI` | Default **false**; API can ship with flag off |
| D-8 | Gap filters | Fixed presets: `rubika_live AND NOT bale_live`, reverse, plus duplicate / missing_reason / out_of_panel |
| D-9 | Duplicate includes pending CREATE | Count only **SUCCEEDED** live; PENDING/RETRY shown as `pending` sub-state, not duplicate |

## 8. Tests required

Unit (register in `scripts/unit-specs.txt`):

1. `coverage-matrix.spec.ts` — `foldLiveRemoteMessages` integration; duplicate detection (2 SUCCEEDED same dest); gap filter predicates; link sanitizer drops unknown URLs.
2. `omnichannel-coverage.service.spec.ts` — pagination, summary counts, filter=`duplicate`.
3. `omnichannel-rbac.spec.ts` — coverage GET → PUBLISHER; ingest → OWNER + goRef.

Integration (Postgres disposable, skip without DB):

4. Seed product with two SUCCEEDED CREATE same destination → `GET coverage/duplicates` count ≥ 1.
5. Absence reason PUT → read back on cell; audit row `panel`.
6. Out-of-panel ingest idempotent double POST → single audit pair.

Frontend:

7. `admin-omnichannel-coverage.spec.ts` — duplicate badge, filter chips, error state.

**Acceptance (stage2 §6 / owner):** on production or staging DB snapshot, **filter duplicate + Bale column** shows **≥ 9** known duplicate SKUs (owner validates list against manual audit); revert PR removes tab/API only.

Pass bar: existing omnichannel unit specs green + `tsc` clean; coverage specs added.

## 9. Must-do vs owner-gated

| Must-do (implementer, after PR-7 merge) | Owner-gated |
| --- | --- |
| Pure coverage + duplicate helpers + API | Written **GO** before merge/deploy |
| Absence reason migration + CRUD | Confirm D-3 Bale link policy |
| Coverage UI tab behind flag | Enable `OMNICHANNEL_COVERAGE_UI` on Iran |
| WORKLOG + session report | **Manual** out-of-panel historical Bale ingest (5 pub / 11 delete) via POST ingest + GO-ref |
| Wire audit `source=out_of_panel` list | Validate «۹ تکراری بله» SKU list matches matrix |
| | Optional: deep-link to PR-9 composer when merged |

## 10. Rollback

Revert PR or set `OMNICHANNEL_COVERAGE_UI=false`. Migration table harmless empty. No worker behavior change.

## 11. Non-goals

Telegram **egress** / Worker custom domain / `TELEGRAM_API_URL` / `TELEGRAM_MEDIA_UPLOAD_MODE` (**PR-12**); **token vault** / `OMNICHANNEL_VAULT_KEY`; **PR-14** bots/inbound/webhook/PFI/inbox; **composer** wizard, dry-run, bulk Owner+GO publish (**PR-9**); **channel_settings** per-channel form + template activation (**PR-10**); media validation scan (**PR-11**); **alerts** including «اختلاف پوشش > N» automation (**PR-13**); **god-service** refactor (**PR-15**); SMS / `.tmp-sms-panel/**`; enabling live connectors except read-only DB; changing idempotency/HOLD/cap/claim (**PR-3–5**); implementing delete/edit/backup (**PR-7** — consume only); automatic Telegram/Bale/Rubika channel sync; outbox row DELETE; **`TARANOM_DEPLOY_FORCE` / `SKIP_DRAIN`**.

## 12. Sequence

1. Rebase on master with **PR-7** merged (`delivery_message` helper available).
2. Implement pure `coverage-matrix.ts` + unit tests (can land early in parallel_prep).
3. Service + SQL + controller routes + RBAC.
4. Migration absence table + entity.
5. Admin coverage tab + flag.
6. Unit/integration → report + WORKLOG → **wait for GO** → deploy Iran only per runbook.
