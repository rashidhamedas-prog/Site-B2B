# Panel urgent fixes — file plan (architect only · 2026-10-29)

Source: `stage2-design.md` §2 · §3.1–3.2 · §3.4 (گروهی) · §4 · GO حامد **۲۹ اکتبر ۲۰۲۶** for **section 1 ONLY** · base `origin/master` @ `d2bf03fb` (PR-9) · branch target **`fix/omnichannel-panel-urgent-20261029`**.

Gate: **CODE** (implementer after this plan) · **ONE PR** · no merge/deploy without separate GO · **no FORCE / connector enable / Telegram egress / SMS / invented channel IDs**.

---

## 0. Headline + HARD STOP (canary identity)

### 0.1 STOP — do not mutate canary for `4858359991`

Repo evidence treats **Bale chat `4858359991` as the wholesale (عمده) Bale channel itself**, not a separate test room:

| Evidence | Claim |
| --- | --- |
| `docs/WORKLOG.md` (~2026-10-20) | `@toliditaranom` = «تولیدی ترنم…» **id `4858359991`**, registered as canary destination |
| `docs/reports/2026-10-28-pre-pr6-continue119-status.md` | DEAD row destination labeled **«کانال عمده بله / `4858359991`»** |
| Design docs (PR-7/10, stage1 HR-8) | Same id listed as **sole allowed live canary smoke** |

**Per owner rule:** if `4858359991` **IS** the wholesale Bale channel → **STOP; report; do not change** its canary / destinationKey / LIVE role in this PR.

**Implementer MUST NOT:**

- Clear `isCanary` on the destination whose `destinationKey` is `4858359991` / `@toliditaranom` (Bale).
- Invent a replacement canary chat id.
- Point Rubika/Telegram wholesale production keys at canary.

**Owner decision (out of band, before any ops canary remapping):** either (A) keep dual-role (prod = canary) with **hard UI+API warning**, or (B) provision a *new* private canary chat and migrate `isCanary` later under a separate GO. **This PR only ships the guardrails + warning path (A-safe); no identity rewrite.**

### 0.2 Rubika wholesale `@Toliditaranom_omde`

No committed destination seed in repo. Ops (Iran read-only SQL) must list `omnichannel_channel_destinations` joined to RUBIKA WHOLESALE connections. If that key (or displayName matching) has `settings.isCanary=true` while also being the live wholesale channel → **clear canary** (safe; not the STOP id). Same for any non-`4858359991` Bale destination wrongly marked canary.

---

## 1. Invariants

1. **Shared core:** Product / Order / Inventory / Admin / Postgres unchanged; connectors stay as deployed; no `OMNICHANNEL_*` enable flags flipped by this PR.
2. **Canary policy (code):** A destination that is **LIVE-ready production** (`verified.canPost === true` **and** `autoPublishMode` path would select it under LIVE, **or** connection channel destination is the primary wholesale/retail chat) **must not silently become test destination** without Owner ack. Preferred: **reject** `isCanary=true` when `looksLikeLivePrimaryChannel(dest)` unless `forceCanaryOnLive: true` + Owner + `goRef` + typed confirm string. **Exception hardcoded:** never auto-reject/clear **`4858359991`** in this PR (STOP §0.1) — only surface **banner/warning**.
3. **No accidental real-channel deletes:** §2 post cleanup is **plan + ops SQL only**; agent/CI never calls delete/withdraw on non-canary destinations.
4. **Blast / clear-waiting:** Owner-only (UI always; API harden even when RBAC flag off for these two routes) + **two confirm steps** + reason; enqueue CREATE count **≤ remaining daily room** for **that destination’s** cap (never sum of caps).
5. **Counters:** one definition shared by header Metric, health cards, attention strip — see §5.
6. **Errors:** Persian primary label + technical code in `title`/tooltip; stale lastError (older than last success on same scope) must not present as current «آخرین خطا» without date.
7. **Held rows untouched:** deliveries / SKUs in appendix §8 — list + suggestion only; no revive/retry/edit.
8. **Conflict hygiene:** minimize edits to `AdminOmnichannel.tsx` (claimed by other omni PRs); prefer `admin-omnichannel-ui.tsx` + **new small modules**.

---

## 2. Scope map (section 1 items → work)

| # | Owner ask | CODE vs OPS |
| --- | --- | --- |
| 1 | Test dest: Rubika wholesale + Bale wholesale must not be canary; canary only Bale `4858359991`; stop if that id is wholesale | **HARD STOP report** + CODE guard/warn; OPS: unmark Rubika `@Toliditaranom_omde` if canary; **no** change to `4858359991` |
| 2 | Live list post «PR7 canary delete-edit 20261028T134214Z» | **OPS find** (SQL); if canary-only → hide/archive or PR-7 delete on canary; if on real channel → delete **with `post_backups`** (ops executes). Plan only — no agent delete |
| 3 | «شروع ارسال دسته» + «خالی کردن صف انتظار» | CODE: Owner + 2nd confirm; cap + spacing; never exceed room in one run |
| 4 | Raw errors → FA + code tooltip; stale lastError | CODE UI (+ tiny health helper) |
| 5 | Counters one source; cap per destination not sum | CODE health + status DTO + UI Metrics |
| 6 | Pagination publish list, queue, alt-text | CODE API query `page`/`limit` + UI pager |
| 7 | Persian labels LIVE/RETRY/DEAD/HOLD/stalled/WITHDRAWN/UPLOAD/blast/canary | CODE labels module |
| 8 | Do not touch held (5047, K-00006, Telegram HOLD) | Appendix only |

---

## 3. Target design (implementer contract)

### 3.1 Canary / live-primary guard (API)

**New pure module:** `apps/api/src/modules/omnichannel/canary-live-guard.ts` (+ `.spec.ts`).

```ts
// Pseudocontract — do not invent chat IDs
export const BALE_CANARY_CHAT_ID = '4858359991'; // documented dual-role; STOP: no auto-clear

export function isDocumentedBaleCanaryKey(destinationKey: string): boolean;
export function looksLikeLivePrimaryChannel(input: {
  destinationKey: string;
  displayName?: string;
  provider: 'TELEGRAM' | 'BALE' | 'RUBIKA';
  channel: 'RETAIL' | 'WHOLESALE';
  verifiedCanPost?: boolean;
}): { livePrimary: boolean; reason: string };

export function assertCanaryToggleAllowed(input: {
  wantCanary: boolean;
  destinationKey: string;
  // ...
  forceCanaryOnLive?: boolean;
  goRef?: string;
}): { ok: true } | { ok: false; code: 'live_primary_needs_force' | 'blocked_rubika_wholesale_canary'; messageFa: string };
```

Wire in `patchDestination` / create destination when `isCanary === true`:

- Rubika WHOLESALE matching `@Toliditaranom_omde` (case-insensitive key/username) → **400** with Persian message (cannot be test dest).
- Other live-primary (verified + non-canary-pattern names) → **400** unless Owner force + goRef.
- If key is `4858359991` / `@toliditaranom` on BALE → **allow keep canary**; return public flag `canaryIsLivePrimaryWarning: true` on destination/status for UI banner.

**UI:** banner on destination row + health: «این مقصد هم کانال زنده عمده و هم مقصد آزمایشی است (شناسه canary مستند). تا تصمیم مالک، تغییر خودکار اعمال نمی‌شود.»

### 3.2 PR7 leftover post (OPS only — no CODE delete)

**Find (Iran, read-only):**

```sql
-- illustrative; ops adjusts schema column names from entities
SELECT p.id, p.status, p."sourceType", p.channel, d."destinationKey", d.settings->>'isCanary' AS is_canary,
       del.id AS delivery_id, del.status AS del_status, del."providerMessageId", del."lastError"
FROM omnichannel_publications p
JOIN omnichannel_publication_deliveries del ON del."publicationId" = p.id
JOIN omnichannel_channel_destinations d ON d.id = del."destinationId"
WHERE p.projection::text ILIKE '%PR7 canary delete-edit 20261028T134214Z%'
   OR p.projection::text ILIKE '%20261028T134214Z%'
   OR del."lastError" ILIKE '%20261028T134214Z%';
```

**Decision tree (ops executes after Owner GO):**

| Case | Action |
| --- | --- |
| All live messageIds only on canary dest (`isCanary` or key `4858359991`) | Prefer panel hide/withdraw **or** PR-7 delete-plan → delete on that dest with backup |
| Any messageId on non-canary / Rubika wholesale / Telegram live | **DELETE only via PR-7** with `post_backups` + Owner `goRef`; never raw provider API from agent |
| Not found | Report «absent»; no further action |

**CODE in this PR:** optional admin filter `q=` on publications list to search caption/projection text (helps find) — **no** auto-delete button wired to real channels.

### 3.3 Blast + clear-waiting gates

**Today:**

- `clear-waiting`: `@OmnichannelMinRole('OWNER')` + `@RequiresGoRef()` (RBAC flag dependent); UI: prompt + one `confirm`.
- `requeue-by-category`: `@OmnichannelMinRole('PUBLISHER')` + `@OmnichannelOwnerWhenLive()`; service already clips to `dailyRoom` + `minGapSeconds`; UI: **single** `confirm`.

**Target:**

| Control | UI | API |
| --- | --- | --- |
| خالی کردن صف انتظار | Disable unless `omnichannelRole===OWNER` (or RBAC off + admin); step1 reason; step2 type `خالی` or confirm phrase; send `goRef` when RBAC on | Keep Owner; when RBAC **off**, still require `confirm: true` + non-empty reason (already); add `confirmPhrase` optional match |
| شروع ارسال دسته | Same Owner gate **always** (not only when LIVE); preview must show `dailyRoom`, `dailyCap`, `sentToday`, `minGapSeconds`; 2nd confirm showing «حداکثر N پست امروز» | Change controller to `@OmnichannelMinRole('OWNER')` for **non-dryRun**; dryRun stays PUBLISHER+; **hard cap:** `queuedCreates = min(batch, dailyRoom)` — already partially there; add response field `cappedToDailyRoom: true` when truncated; **reject** if client sends `limit`/`force` exceeding room |

Extract UI handlers into `admin-omnichannel-blast.tsx` to avoid bloating god file.

### 3.4 Error UX

Extend `ERROR_LABELS` / `errorLabel` in `admin-omnichannel-ui.tsx` (or split `admin-omnichannel-error-labels.ts`):

| Raw / substring | Persian primary | Tooltip code |
| --- | --- | --- |
| `inconsistent types deduced for parameter $2` / `42P08` | خطای داخلی پایگاه‌داده در رزرو ارسال (رفع‌شده در نسخهٔ جدید؛ این ردیف قدیمی است) | `42P08` |
| `uncertain_after_timeout` | (exists) keep | code |
| `superseded_duplicate` | (exists) keep | code |
| `held_by_ops_no_live_until_canary_go` | ارسال زنده تا تأیید canary متوقف است (نگهداری عملیاتی) | same |
| `WEBPAGE_CURL_FAILED` | پیام‌رسان نتوانست تصویر را از اینترنت بگیرد؛ حالت آپلود رسانه را بررسی کنید | same |

**API/UI last-error freshness:**

- Health card: if `lastErrorAt` < `lastSuccessAt` (or missing dates), show «آخرین خطا (آرشیو · {tehran date})» muted — not red «فعلی».
- Delivery rows: show `relativeTime(updatedAt/failedAt)` next to error; if SUCCEEDED later on same dest, don’t promote old DEAD into header «آخرین خطا».

Pure helper: `admin-omnichannel-error-freshness.ts` + spec.

### 3.5 Counters (single definition)

Document + implement:

| Metric | Definition | Source of truth |
| --- | --- | --- |
| `failedSendsHeader` | Count of deliveries in **current list window** with status∈{DEAD,FAILED} ∧ ¬intentional ∧ ¬connector_disabled **OR** prefer status aggregate `failedRealToday` from API | Prefer new `GET status` / health field `counts.failedReal` (Tehran day); UI must not mix `failing` (window) with tab badge without label |
| `postsToday` | CREATE SUCCEEDED with `sentAt`/`createdAt` in Tehran calendar day **per selected destination** (or per connection when no dest selected — **not** sum across providers) | `status.sentToday` scoped; fix `pickCapQuiet` **max-of-caps** bug in `omnichannel-health.ts` → expose **per destination** `cap: { destinationId, sentToday, dailyCap }` and health card shows **that dest’s** cap when filtered; provider card shows list or «چند سقف — مقصد را انتخاب کنید» not `max(dailyCap)` |
| Attention / Metric «پست‌های امروز» | Same `postsToday` + same `dailyCap` as selected dest rules | Align Callout L2326 with Metric L2364 |

Unit specs for pure assembly of counts.

### 3.6 Pagination

| List | Today | Target |
| --- | --- | --- |
| Publications | hard slice 100 | `GET publications?page=&limit=` (default 20, max 50) + `{ items, total, page, limit }` |
| Outbox / queue | take 100 | same query shape |
| Media alt-text | `listMedia()` unbounded/large | `page`/`limit` (default 20) |

UI: shared `AdminOmnichannelPager` in `admin-omnichannel-pagination.tsx`; wire publish section, ops queue table, media table. Thin state in `AdminOmnichannel.tsx`.

### 3.7 Persian status / mode labels

Centralize in `admin-omnichannel-labels.ts` (re-export from ui):

| Code | FA |
| --- | --- |
| LIVE | زنده |
| CANARY / canary | آزمایشی |
| RETRY | تلاش مجدد |
| DEAD | متوقف |
| HOLD | نگه‌داشته |
| stalled | گیرکرده |
| WITHDRAWN | برداشته‌شده |
| UPLOAD | آپلود |
| blast | ارسال دسته‌ای |

Replace English leftovers in `admin-omnichannel-health.tsx` `modeLabel` and count line (`RETRY`/`DEAD`/`HOLD`/`stalled` → FA). Keep technical code in `title` where useful.

---

## 4. File claims (minimize AdminOmnichannel conflict)

Branch: `fix/omnichannel-panel-urgent-20261029` · worktree: prefer clone/worktree **not** PR-8’s `Site-B2B-pr8`.

### 4.1 Exclusive claims (architect → implementer now)

| Path | Role |
| --- | --- |
| `docs/design/omnichannel-redesign/pr-panel-urgent-20261029-plan.md` | this plan |
| `apps/api/src/modules/omnichannel/canary-live-guard.ts` | NEW pure guard |
| `apps/api/src/modules/omnichannel/canary-live-guard.spec.ts` | NEW |
| `apps/api/src/modules/omnichannel/dto/omnichannel-list-page.dto.ts` | NEW page query DTO |
| `apps/api/src/modules/omnichannel/services/omnichannel-list-page.ts` | NEW pure paginate helper |
| `apps/api/src/modules/omnichannel/services/omnichannel-list-page.spec.ts` | NEW |
| `apps/api/src/modules/omnichannel/services/omnichannel-health.ts` | fix per-dest cap; lastError freshness |
| `apps/api/src/modules/omnichannel/services/omnichannel-health.spec.ts` | if exists / add |
| `apps/web/src/components/admin/admin-omnichannel-error-labels.ts` | NEW — ERROR_LABELS + freshness |
| `apps/web/src/components/admin/admin-omnichannel-error-labels.spec.ts` | NEW |
| `apps/web/src/components/admin/admin-omnichannel-labels.ts` | NEW status/mode FA |
| `apps/web/src/components/admin/admin-omnichannel-labels.spec.ts` | NEW |
| `apps/web/src/components/admin/admin-omnichannel-pagination.tsx` | NEW pager |
| `apps/web/src/components/admin/admin-omnichannel-blast.tsx` | NEW blast/clear UI |
| `apps/web/src/components/admin/admin-omnichannel-health.tsx` | FA labels + stale error + per-dest cap |
| `apps/api/scripts/unit-specs.txt` | register new specs |
| `docs/reports/2026-10-29-omnichannel-panel-urgent.md` | implementer report |
| `docs/WORKLOG.md` | prepend on implement |
| `.ai-dos/tasks/active.yaml` | task claim |
| `.ai-dos/tasks/handoff.md` | handoff |

### 4.2 Soft-reclaim after PR-8 releases (thin hunks only)

| Path | Role |
| --- | --- |
| `apps/api/src/modules/omnichannel/controllers/omnichannel-admin.controller.ts` | Owner on live requeue; pagination query |
| `apps/api/src/modules/omnichannel/services/omnichannel.service.ts` | patchDestination guard; list* page; requeue Owner |
| `apps/api/src/modules/omnichannel/omnichannel-rbac.ts` | only if blast always-Owner matrix |
| `apps/web/src/components/admin/admin-omnichannel-ui.tsx` | re-export labels; thin ERROR_LABELS move |
| `apps/web/src/components/admin/AdminOmnichannel.tsx` | **thin mounts** (blast/pager/banner) |

**Do not claim:** `outbox-worker.service.ts`, adapters, telegram egress, blog.ts, SMS, delete.service (ops may use existing delete after GO).

### 4.3 Must-do (implementer) vs owner-gated

| Must-do in PR | Owner-gated / ops |
| --- | --- |
| Guards, labels, pagination, counter fix, blast double-confirm, error FA | Unmark Rubika wholesale canary in DB |
| Warning banner for dual-role `4858359991` | Any remapping of Bale canary away from wholesale |
| Find-SQL for PR7 post in report | Actual delete/hide of that post + backup |
| Unit specs + tsc | Merge/deploy Iran; connector flags; held-row retries |

---

## 5. Acceptance criteria

1. **STOP documented** in PR description + report: `4858359991` = wholesale Bale; **no** canary clear on that key in diff/ops of this PR.
2. Attempting to mark Rubika `@Toliditaranom_omde` (WHOLESALE) as canary → **400** Persian; unit covers guard.
3. LIVE-primary + canary toggle without force → **400** or blocking modal; force path Owner+goRef only when RBAC on.
4. UI shows dual-role warning when canary key is documented Bale canary.
5. «شروع ارسال دسته» / «خالی کردن صف»: not usable by Publisher; two confirms; dry-run preview shows room; live run never queues CREATE above `dailyRoom`; gap respected (existing scheduleIndex).
6. Listed error strings render FA + `title` with technical code; stale error under last success shows dated archive copy in health.
7. Header «پست‌های امروز» and health cap use **same** per-destination (or explicit multi-cap) definition — **not** `max(dailyCap)` sum illusion.
8. Publications, outbox, media alt tables paginate (page controls + API total).
9. LIVE/RETRY/DEAD/HOLD/stalled/WITHDRAWN/UPLOAD/blast/canary show Persian in health + badges.
10. Diff does **not** mutate HOLD/DEAD rows for 5047 / K-00006 / Telegram HOLD (appendix).
11. No FORCE, no connector enable, no egress URL change, no SMS, no invented destination keys.
12. Specs green for new pure modules; `apps/api` + `apps/web` `tsc --noEmit` clean.

---

## 6. Risks & rollback

| Risk | Mitigation |
| --- | --- |
| Dual-role canary continues to risk live posts on «test» | Banner + owner decision; STOP forbids silent remapping |
| Tightening requeue to Owner breaks Publisher habit | Intentional; document in UI; dryRun still Publisher |
| Pagination breaks clients expecting bare arrays | Keep backward compat: if no `page` query, return array **or** `{ items }` behind Accept — prefer always `{ items, total, page, limit }` and update **only** admin UI in same PR |
| Health cap change shifts numbers operators trust | Report before/after definitions in WORKLOG |
| Conflict with PR-8 on AdminOmnichannel | New modules + tiny mounts; rebase after #coverage |

**Rollback:** revert PR commit; no migration required if pagination/DTO additive only. If a migration sneaks in — **none planned**; reject schema changes in this urgent panel PR.

---

## 7. Test plan (implementer)

1. Unit: `canary-live-guard` (rubika wholesale block; bale 4858359991 warning path; live-primary force).
2. Unit: error labels + freshness helper.
3. Unit: labels FA map.
4. Unit: health `pickCapQuiet` / per-dest cap (regression: must not use max-as-sum).
5. Unit: list page helper.
6. Manual (staging/local): Owner vs Publisher on blast/clear; preview room; pagers.
7. **No** live messenger send in CI; **no** canary ping required for this PR.

---

## 8. Appendix — held deliveries (DO NOT TOUCH)

List + suggestion only. Implementer/ops: **no** revive, retry, edit, withdraw, or connector poke.

| Ref | Context (from prior reports) | Suggestion for Owner (later GO) |
| --- | --- | --- |
| SKU **5047** | Historical DEAD / media issues (`inconsistent types…`, validate_failed, media) on wholesale Telegram/Bale | After panel UX ships: inspect current delivery status; fix media first; single-row Owner reapprove if HOLD; never mass retry |
| **K-00006** | Held / ops marker in prior soak notes | Leave HOLD until explicit canary GO; do not clear `held_by_ops_*` |
| **Telegram HOLD** | Channel or delivery HOLD (`uncertain_after_timeout` / ops) | Confirm message presence on channel before any reapprove; one-at-a-time (PR-4) |

---

## 9. Out of scope (hard)

Worker wiring; live Telegram egress / `TELEGRAM_API_URL` / vault (PR-12); destination canary **send**; enabling connectors; SMS; inventing Bale/Rubika/Instagram APIs; outbox row DELETE; blog author channel slice; rewriting create-order channel from customer type; PR-8 coverage feature work; touching held rows above.
