# PR-13 Unanswered message alert (REQ-O4) — file plan (plan only, no code)

Source: `stage2-design.md` §3.8 (هشدار «بی‌پاسخ > ۱ دقیقه») · §5.5 · §6 row PR-13 · `stage1-requirements.md` REQ-O4 · REQ-B4 (owner_chat_id) · `pr-execution-queue.md` row 12 (Alerts) · GO حامد ۲۹ اکتبر ۲۰۲۶ — **ARCHITECT ONLY**.

Gate: **CODE** · **hard depends on PR-10** (`ownerChatId` in per-destination `channel_settings`) · **soft depends on PR-12** for BALE/RUBIKA notify-to-owner path · **does not implement PR-14 inbound** (webhook/polling) — only alert pipeline + minimal message store contract · Preferred worktree: `D:/proje/Site-B2B-pr13`.

## 0. Headline finding

**REQ-O4 lists many ops alerts; this PR ships only the unanswered-bot-message slice:** if a customer message on a channel bot stays without staff/auto reply for **> 60 seconds**, raise an alert (1) **in the admin panel** and (2) **to that channel’s `ownerChatId`** (from PR-10 settings). There is **no** `bot_conversation` / `bot_message` today and **no** inbound (PR-14). Inventing live chat IDs or enabling connectors is forbidden. Design: additive conversation/message tables + scanner + panel feed + optional messenger notify using **Owner-entered** `ownerChatId` only; inbound writers deferred to PR-14 (and tests seed rows).

Other REQ-O4 items (DEAD/HOLD, coverage gap > N, Worker ping, deploy-while-locked) are **non-goals** unless already covered by prior PRs — do not expand scope.

## 1. Invariants

- **Dependency:** `ownerChatId` read from PR-10 `channel_settings` per destination. Missing/blank → **panel alert only** (or skip messenger leg); **never** invent or hardcode chat IDs (no canary chat as owner default).
- **Per-channel:** alert routes to **that** destination’s owner; Bale unanswered ≠ Rubika owner.
- **Secrets / HR-3:** alert payloads never include bot tokens; message text may be truncated/redacted for PII in panel CSV later — default store preview ≤ 200 chars.
- **No connector enable in CI;** notify path uses existing adapters only when Owner has configured destination + vault token (PR-12) and connectors are already LIVE in that environment — scanner still records panel alert if send fails.
- **Idempotency:** one open alert per `(conversationId)` until answered or snoozed; no alert storms every poll tick.
- **Tehran time** in UI; store UTC.
- **Do not edit** `apps/web/src/lib/blog.ts`.

## 2. Existing behavior vs gaps

| Piece | Today | Gap |
| --- | --- | --- |
| `ownerChatId` | Planned/landed in PR-10 channel_settings | PR-13 **consumes**; does not redefine field |
| Bot inbound | None (PR-14) | Need **schema + insert API for tests / future webhook** |
| Alerts | No omnichannel alert feed | Panel + optional messenger |
| §3.8 Inbox UI | Phase last | PR-13: compact **Alerts** strip/tab only — not full inbox |

## 3. Target design

### 3.1 Data model (additive)

| Table | Columns (conceptual) |
| --- | --- |
| `omnichannel_bot_conversations` | id, destinationId, provider, customerChatId, lastCustomerMessageAt, lastStaffReplyAt, status (`open`\|`closed`), createdAt |
| `omnichannel_bot_messages` | id, conversationId, direction (`inbound`\|`outbound`\|`system`), bodyPreview, providerMessageId, createdAt |
| `omnichannel_alerts` | id, type (`bot_unanswered`), destinationId, conversationId, severity, status (`open`\|`acked`\|`resolved`), createdAt, notifiedOwnerAt, panelSeenAt, detail jsonb (no secrets) |

Migration additive + `down()`; **Iran Postgres backup before apply**.

### 3.2 Scanner

- Interval: worker tick or lightweight api cron (D-1: prefer **worker** when `OMNICHANNEL_WORKER=true`, shared pure `evaluateUnansweredAlerts(now, rows, thresholdSec=60)`).
- Condition: `lastCustomerMessageAt` older than 60s AND (`lastStaffReplyAt` null OR < lastCustomer).
- Actions: upsert open `omnichannel_alerts` row; enqueue **panel**; if `ownerChatId` present → attempt notify (below).

### 3.3 Notify paths

| Path | Behavior |
| --- | --- |
| Admin panel | `GET /omnichannel/alerts?status=open` · badge on Omnichannel shell · ack/resolve endpoints |
| Owner messenger | Send short Persian text to `ownerChatId` via **same provider** as destination (BALE/RUBIKA after PR-12). Telegram owner notify: **structure only / skip send** until Telegram phase (align with PR-12 non-goals) — still create panel alert. |
| Failure | Record `notifyErrorCode` on alert; do not retry forever (cap 3) |

**Never** use invented IDs; never SMS.

### 3.4 API

| Method | Path | Role | Purpose |
| --- | --- | --- | --- |
| GET | `alerts` | VIEWER+ | List open/recent unanswered (+ filters) |
| POST | `alerts/:id/ack` | PUBLISHER+ | Mark seen in panel |
| POST | `alerts/:id/resolve` | PUBLISHER+ | Close when handled |
| POST | `bots/conversations/seed` (test/staging only) **or** internal service method | OWNER + flag | Insert fixture conversation/message for acceptance — **disabled in production** unless Owner GO |

PR-14 later adds webhook → same tables; no duplicate schema.

## 4. UI

| Component | IA | Flag |
| --- | --- | --- |
| `admin-omnichannel-alerts.tsx` | Banner/list under health or tab **«هشدارها»** (subset of §3.8 until PR-14) | `OMNICHANNEL_UNANSWERED_ALERTS_UI` |

Show: channel, age (Tehran), destination label, whether owner notified, link «باز کردن تنظیمات کانال» if `ownerChatId` empty (PR-10 settings).

**Conflict avoid:** thin mount in `AdminOmnichannel.tsx`; do not rebuild inbox/composer.

## 5. Files to claim (`file_claims`)

Branch: `feat/omnichannel-pr13-unanswered-alert` · worktree **`D:/proje/Site-B2B-pr13`**.

| File | Action |
| --- | --- |
| `apps/api/src/modules/omnichannel/unanswered-alert-policy.ts` | NEW — pure 60s evaluation + idempotency keying |
| `apps/api/src/modules/omnichannel/unanswered-alert-policy.spec.ts` | NEW |
| `apps/api/src/modules/omnichannel/entities/omnichannel-bot-conversation.entity.ts` | NEW |
| `apps/api/src/modules/omnichannel/entities/omnichannel-bot-message.entity.ts` | NEW |
| `apps/api/src/modules/omnichannel/entities/omnichannel-alert.entity.ts` | NEW |
| `apps/api/src/database/migrations/*-omnichannel-unanswered-alerts.ts` | NEW |
| `apps/api/src/database/migrations/*-omnichannel-unanswered-alerts.spec.ts` | NEW |
| `apps/api/src/modules/omnichannel/services/omnichannel-alerts.service.ts` | NEW — scan, list, ack, resolve, notify orchestration |
| `apps/api/src/modules/omnichannel/services/omnichannel-alerts.service.spec.ts` | NEW |
| `apps/api/src/modules/omnichannel/dto/omnichannel-alerts.dto.ts` | NEW |
| `apps/api/src/modules/omnichannel/controllers/omnichannel-admin.controller.ts` | EDIT — alerts routes |
| `apps/api/src/modules/omnichannel/omnichannel.module.ts` | EDIT — register entities/service |
| `apps/api/src/modules/omnichannel/omnichannel-rbac.ts` | EDIT |
| `apps/api/src/modules/omnichannel/channel-settings.ts` | EDIT — **read-only** helper `ownerChatIdForDestination` (owned by PR-10; soft-reclaim only) |
| `apps/api/src/modules/omnichannel/services/outbox-worker.service.ts` | EDIT — optional tick hook calling alerts scanner (keep small) |
| `apps/api/src/modules/omnichannel/services/omnichannel.service.ts` | EDIT — **avoid** if possible; prefer alerts service only |
| `apps/api/src/modules/omnichannel/adapters/bale.adapter.ts` | EDIT — only if shared `sendPlainText(chatId)` helper missing (prefer tiny method; no new APIs) |
| `apps/api/src/modules/omnichannel/adapters/rubika.adapter.ts` | EDIT — same |
| `apps/web/src/components/admin/admin-omnichannel-alerts.tsx` | NEW |
| `apps/web/src/components/admin/admin-omnichannel-alerts.spec.ts` | NEW |
| `apps/web/src/components/admin/AdminOmnichannel.tsx` | EDIT — mount alerts badge/list behind flag |
| `.env.example` | EDIT — `OMNICHANNEL_UNANSWERED_ALERTS_UI`, `OMNICHANNEL_UNANSWERED_THRESHOLD_SEC` (default 60) |
| `apps/api/scripts/unit-specs.txt` | EDIT |
| `docs/WORKLOG.md`, `docs/reports/2026-10-xx-omnichannel-pr13-unanswered-alert.md` | EDIT/NEW |

**Do not touch:** Telegram egress / `TELEGRAM_API_URL` / Worker domain; vault crypto core beyond using resolve token; media scan (**PR-11**); full bots webhook/PFI/inbox (**PR-14**); inventing chat IDs; SMS; coverage-gap automation; god-service split (**PR-15**); connector CI enable.

## 6. Open decisions (safe defaults)

| # | Question | Recommended default |
| --- | --- | --- |
| D-1 | Scanner host | Worker tick every N seconds when flag on; pure fn unit-tested |
| D-2 | Threshold | 60s (`OMNICHANNEL_UNANSWERED_THRESHOLD_SEC`) |
| D-3 | Telegram owner notify | Panel only until Telegram phase |
| D-4 | Empty ownerChatId | Panel alert + UI hint to fill PR-10 settings — **no** fallback chat |
| D-5 | Full REQ-O4 suite | Deferred; this PR = unanswered only |
| D-6 | Production seed route | Off; acceptance via unit + disposable DB insert in integration |

## 7. Tests / acceptance

1. Policy: message at t0, no reply at t0+61s → alert; reply at t0+30s → no alert; second scan → no duplicate open alert.
2. Service: missing ownerChatId → panel row, `notifiedOwnerAt` null.
3. Service: ownerChatId set + mock adapter → one notify; token missing → panel still open + error code.
4. RBAC: Viewer GET ok; Viewer cannot resolve.
5. Frontend: empty owner shows Persian hint; no fabricated id in UI.
6. Stage2: «هر هشدار در تست شلیک شود» for **this** type — fire via fixture conversation.

## 8. Must-do vs owner-gated

| Must-do | Owner-gated |
| --- | --- |
| Schema + policy + panel alerts + specs | GO merge/deploy |
| Wire read of PR-10 `ownerChatId` | Iran DB backup before migration |
| Idempotent scanner | Owner **enters real `ownerChatId` per channel** in panel (never agent-invented) |
| WORKLOG + report | Enable UI flag; optional live notify smoke only with Owner-provided id |
| Soft wait for PR-12 before Bale/Rubika notify | No FORCE / SKIP_DRAIN |

## 9. Rollback

Flags off → scanner no-ops; UI hidden. Tables retained (harmless). Reverse migration only if empty / Owner approves.

## 10. Non-goals

Full inbox/PFI/webhook (**PR-14**); DEAD/HOLD/coverage/deploy alert pack; Telegram owner push; SMS; inventing chat IDs; connector enable; media (**PR-11**); vault/egress redesign (**PR-12** — consume only).

## 11. Sequence / conflicts

```
PR-10 (ownerChatId) ──hard──► PR-13
PR-11 (media)        ──parallel──► (no edge to 13)
PR-12 (BALE/RUBIKA vault+egress) ──soft──► PR-13 messenger notify leg
PR-13 ──before──► PR-14 (inbound fills same tables)
```

**Conflict avoid:**

- **`AdminOmnichannel.tsx`:** add only alerts mount + badge; do not reformat settings/media tabs from PR-10/11.
- **`omnichannel.service.ts`:** do not park scanner logic in god-service — `omnichannel-alerts.service.ts` owns it.
- **`channel-settings.ts`:** read helper only; no PATCH redesign.
- **Adapters:** no new Bot API surface beyond existing sendMessage/send plain; no discover-chats inventing owners.
