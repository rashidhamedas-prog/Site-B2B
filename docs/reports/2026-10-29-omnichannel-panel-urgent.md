# Omnichannel panel urgent §1 — 2026-10-29

GO حامد **۲۹ اکتبر ۲۰۲۶** — implement + open PR only (parent merges/deploys).

Branch: `fix/omnichannel-panel-urgent-20261029` · worktree `D:/proje/Site-B2B-panel-urgent` · base `origin/master` @ `d2bf03fb`.

Plan: `docs/design/omnichannel-redesign/pr-panel-urgent-20261029-plan.md`.

## HARD STOP confirmation

| Item | Action in this PR |
| --- | --- |
| Bale chat **`4858359991`** («کانال عمده بله» / `@toliditaranom`) | **NOT** cleared, remapped, or rewritten. Dual-role **warning only** (`canaryIsLivePrimaryWarning` + UI banner). Guard **allows** keeping `isCanary`. |
| Rubika **`@Toliditaranom_omde`** (WHOLESALE) | **Blocked** as canary → API **400** Persian (`blocked_rubika_wholesale_canary`). Ops: if currently `isCanary=true` in Iran DB, clear canary (not done by agent). |
| Held **5047 / K-00006 / Telegram HOLD** | **Untouched** — appendix only. |
| FORCE / SKIP_DRAIN / egress / SMS / connector enable / mass DEAD retry / live delete of real-channel posts | **Not** in diff. |

## Delivered (CODE)

1. **Canary guard** — `canary-live-guard.ts` (+spec); wired in `createDestination` / `patchDestination`.
2. **PR7 leftover post** — find SQL + decision tree in plan §3.2; optional `q=` on publications list. **No agent delete.** Ops must run Iran read-only SQL for caption `PR7 canary delete-edit 20261028T134214Z`.
3. **Blast + clear-waiting** — Owner gate (UI + API live); two confirms; `confirmPhrase=خالی`; dry-run exposes `dailyRoom`/`dailyCap`/`sentToday`/`minGapSeconds`; live returns `cappedToDailyRoom`.
4. **Error FA** — `admin-omnichannel-error-labels.ts` (+ freshness helper); 42P08 / held_by_ops / WEBPAGE_CURL_FAILED / etc.; stale lastError archive copy in health.
5. **Counters** — `pickCapQuiet` no longer `max()` across dests; `capAmbiguous` + `destinationCaps`; status `sentToday` stays per selected dest.
6. **Pagination** — publications / outbox / media → `{ items, total, page, limit }` (default 20, max 50) + UI pager.
7. **FA labels** — LIVE/RETRY/DEAD/HOLD/stalled/WITHDRAWN/UPLOAD/blast/canary.
8. **Held appendix** — below.

## Appendix — held deliveries (DO NOT TOUCH)

| Ref | Suggestion (later Owner GO) |
| --- | --- |
| SKU **5047** | Inspect current delivery; fix media first; single-row reapprove if HOLD; never mass retry |
| **K-00006** | Leave HOLD until explicit canary GO; do not clear `held_by_ops_*` |
| **Telegram HOLD** | Confirm message on channel before reapprove; one-at-a-time (PR-4) |

## Evidence

- Unit: `canary-live-guard`, `omnichannel-list-page`, `omnichannel-health` (cap regression), `omnichannel-phase-acceptance`, web `error-labels`, `labels`, `admin-omnichannel-health`.
- `apps/api` + `apps/web` `tsc --noEmit` clean.

## Rollback

Revert PR commit. No migration. Pagination clients must use `{ items }` (admin UI updated in same PR).

## Leftover risks / ops

- Dual-role canary on wholesale Bale continues until Owner chooses path B (new private canary chat).
- Unmark Rubika wholesale canary in DB if set.
- Find/hide/delete PR7 leftover post only with Owner GO + backup when on real channel.
- Merge/deploy Iran needs separate GO.
