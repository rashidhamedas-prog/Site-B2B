# PR-14 Order bots (inbound + inbox + PFI) — file plan (ARCHITECT ONLY, no code)

Source: `stage2-design.md` §0.8 · §3.8 · §5.1 · §5.4 inbound · §5.5 unanswered · §5.6 inbox · §6 row PR-14 · `stage1-requirements.md` **REQ-B1..B5**, **REQ-C9** · `req-telegram.md` **TG#29–32** · `req-rubika-bale.md` **RB P1-4**, **R9** · `req-technical.md` §13 · `pr-execution-queue.md` row 14 · `pr10-settings-templates-plan.md` · `pr13-unanswered-alert-plan.md` · GO حامد **۲۹ اکتبر ۲۰۲۶** (`cursor-next-fixes-and-pr10-14.md`) — **ARCHITECT ONLY** (this document).

**Upstream status (origin/master tip `ab4019b0`, 29 Oct 2026):**

| PR | Status | What PR-14 consumes |
| --- | --- | --- |
| **PR-10** `#142` (`a853b18c`) | **MERGED** | `publishSettings.channelSettings` + `ownerChatId` / `orderBotId` / `orderBotUsername`; helpers `ownerChatIdForDestination` / `ownerChatIdConfigured` in `channel-settings.ts`; UI «تست آی‌دی مقصد…» **disabled** until this PR |
| **PR-11** `#143` | MERGED | media — **do not reopen** |
| **PR-12** `#144` | MERGED | Bale/Rubika vault egress only — **do not touch** `telegramApiBase` / Worker / Telegram token move |
| **PR-13** `#146` tip | **MERGED** | additive tables `omnichannel_bot_conversations` / `_messages` / `_alerts` + scanner + panel alerts; **inbound writers deferred here** |

Gate: **CODE** after Owner implement GO · **hard depends PR-10 + PR-13 fields/tables** (already on tip) · **preferred after PR-15** god-service split (soft; FSM/pure units OK earlier) · **skip Telegram egress** (PR-12 already landed for Bale/Rubika only — leave Telegram path untouched) · **no** `TARANOM_DEPLOY_FORCE` / `SKIP_DRAIN` · **Postgres backup on Iran before every migration**.

**HARD STOP — canary dual-role:** Bale peer `4858359991` **is** wholesale Bale (`کانال عمده بله` / `@toliditaranom`). **Do not clear/remap** `isCanary` on that key; reuse `canary-live-guard.ts` warn/guards only. Live smoke DMs may use that peer only as the documented canary; **zero** real-channel delete/edit; **no invented IDs**.

**Implement order (when CODE GO):** **Bale first → Rubika second → Telegram full code last but flags OFF** until a separate Telegram-bot phase. After green smoke, bots stay **OFF** until Hamed enables from panel.

**Iran sole origin.** No SMS. No FORCE/SKIP_DRAIN. No invent destination/chat IDs. No real-channel delete/edit.

## 0. Headline finding

**Publish bots can send; order-taker inbound still missing.** Tip adapters expose `sendMessage` / `getUpdates` for chat discovery only (`discoverChats` never acknowledges offsets). PR-13 landed **empty** conversation/message stores + unanswered scanner (seed/test writers only). There is still **no** webhook controller, **no** FSM, **no** inbox UI (§3.8), **no** messenger → `/v1/orders` + PROFORMA (`PFI-*`) bridge. PR-10 stores empty **`ownerChatId`** per destination; «تست» stays disabled until PR-14. PR-14 is a **delta on PR-13 tables**: additive columns + inbound + professional order flow (live catalog price/stock + `product.minOrderQty`) + inbox + sensitive handoff via **`ownerChatId` only** (never DM Hamed personally) — **all order bots default OFF**, Owner-only enable.

## 1. Invariants (must hold after PR-14)

- **Shared monolith:** Product, Order, Inventory, Admin, PostgreSQL remain SoT. Bots call existing order/invoice services; **no** second order store.
- **No stock from connectors:** never decrement/overwrite `retailStock` / `wholesaleStock` / legacy `stock`. Availability = catalog projection only.
- **Live price/stock only (REQ-B5 / TG#32):** quotes from current DB/PDP for the bot commerce channel; **no** hardcoded prices, delivery promises, or discount claims.
- **minOrderQty (REQ-C1 / TG#33):** `qty ≥ product.minOrderQty`; reject below with polite Persian copy. Prefer WHOLESALE bot catalog path; **no** invented global MOQ constant.
- **PFI via existing APIs (REQ-B3 / TG#30):** `OrderService` + invoice `type=PROFORMA` → `PFI-*`. Final customer message includes that number. Canary PFIs **cancellable/markable test** so ops is not polluted.
- **Per-channel bot enable (default OFF):** `orderBotEnabled=false` until **Owner + non-empty `goRef`**. After smoke, flags remain **OFF**.
- **owner_chat_id (REQ-B4 / TG#31):** read via PR-10 `ownerChatIdForDestination(destination.publishSettings)`. Missing → persist inbox + auto-reply; forward skipped with audit `owner_chat_missing`. **Never** hardcode personal chat ids; **never** DM Hamed from bot code.
- **Sensitive path (RB P1-4):** first-order / credit / special price / complaint → no bot commercial decision; customer «کارشناس پیگیری می‌کند»; inbox tag «حساس»; forward summary to `ownerChatId`; panel «ارجاع به سوشال مدیا». Escalation to Hamed = **human SM only**.
- **Idempotent inbound:** unique provider update key (Bale/`update_id`, Rubika equivalent, Telegram `update_id`); duplicate → 200 no-op. Prefer unique on `(provider, providerMessageId)` (extend PR-13 column) or additive `providerUpdateId` + `provider`.
- **PR-13 coexistence:** inbound **must** set `lastCustomerMessageAt` / clear or bump `lastStaffReplyAt` so unanswered scanner keeps working; resolve alerts on admin reply / auto-ack paths without inventing a second alert bus.
- **Secrets:** webhook secret / tokens never in logs, CSV, inbox UI, or audit; `assertNoPlaintextSecrets` + redact. Logs: conversation id, provider, update id, step — **not** full phone/address.
- **No Telegram egress change:** inbound **code may land** behind flags; **must not** change `TELEGRAM_API_URL`, Worker domain, vault Telegram path, or media upload mode. Telegram bot stays **OFF**.
- **No invented provider APIs:** Bale — only docs.bale.ai / existing `bale.adapter.ts`. Rubika — **getUpdates + offset_id only** (no invented webhook). Telegram — Bot API webhook/`secret_token` via existing Worker path when that phase is GO’d; until then stub OFF.
- **Canary dual-role:** never auto-unmark `4858359991`; smoke ≤ one scripted DM path; no mass DEAD retry; no real-channel delete/edit.
- **No SMS** / no `.tmp-sms-panel/**`.
- **Do not edit** `apps/web/src/lib/blog.ts` (TASK-20260831-003).
- **Performance:** webhook returns fast (async process ≤ SLA); inbox paginated; poller interval bounded; rate-limit per external user; no heavy admin-home refetch.

## 2. Existing behavior vs stage2 / REQ gaps

### 2.1 What exists (tip `ab4019b0`)

| Piece | Location | Behavior today |
| --- | --- | --- |
| Publish adapters | `bale.adapter.ts`, `rubika.adapter.ts`, `telegram.adapter.ts` | Outbound post/edit/delete; `discoverChats` via getUpdates **without** ack |
| Channel settings (PR-10) | `channel-settings.ts`, `omnichannel-settings.service.ts`, `admin-omnichannel-channel-settings.tsx` | Nested `channelSettings` incl. empty `ownerChatId`; «تست» disabled (`title` → PR-14) |
| Bot tables (PR-13) | `omnichannel-bot-conversation.entity.ts`, `omnichannel-bot-message.entity.ts`, mig `20261029-002` | Minimal schema: dest/provider/`customerChatId`/timestamps/status; messages: `direction` inbound\|outbound\|system + `bodyPreview` ≤200 + `providerMessageId` |
| Alerts (PR-13) | `unanswered-alert-policy.ts`, `omnichannel-alerts.service.ts`, `admin-omnichannel-alerts.tsx` | Scanner >60s → panel + optional owner notify (Bale/Rubika); Telegram notify panel-only |
| Canary guard | `canary-live-guard.ts` | Dual-role Bale canary warn; Rubika wholesale live blocked as canary |
| Orders / MOQ | order create path | Enforces `minOrderQty` on WHOLESALE |
| Proforma | `invoice.service.ts` | `PFI-{year}-{nnnnn}` for `PROFORMA` |
| Inbox UI §3.8 | — | **Missing** (alerts strip only) |
| Order inbound / FSM / PFI bridge | — | **Missing** |

### 2.2 Gaps vs REQ-B1..B5 / REQ-C9 / TG#29–32 / RB P1-4 / R9

| Requirement | Gap |
| --- | --- |
| REQ-B1 inbound 3 bots + inbox; zero lost messages | No webhook/poll consumer writing live rows |
| REQ-B2 auto-reply <1 min + order link | No FSM / menu |
| REQ-B3 PFI via orders+invoices | No bot→order bridge |
| REQ-B4 owner_chat_id + sensitive via SM | Field exists empty; no forward/tag/test ping |
| REQ-B5 live catalog | No bot catalog reader |
| REQ-C9 / TG#29 `start=SKU` deep-link | No start-payload parser |
| Panel §3.8 inbox | No conversations / reply / ارجاع / unanswered thread UI |
| Rate limit / anti-spam | Missing |
| Per-bot OFF default | Missing (`orderBotEnabled`) |
| Schema for FSM | PR-13 tables lack state/tags/order links/idempotency uniqueness |

## 3. Target architecture

### 3.1 Transport matrix (no invented APIs)

| Provider | Bot handle (ops — Owner-entered, not seeded) | Inbound | Secret | Notes |
| --- | --- | --- | --- | --- |
| **BALE** (slice 1) | from `orderBotUsername` settings | Prefer **webhook** if documented (`setWebhook` + secret header); else **secure polling** with **acknowledged** offset (unlike discoverChats) | Env `secretRef`-style name e.g. `BALE_ORDER_WEBHOOK_SECRET` (never in DB/UI) | Canary smoke only; dual-role peer guard |
| **RUBIKA** (slice 2) | from settings | **Polling only** `getUpdates(limit, offset_id)` + persist `next_offset_id` | N/A webhook; poller only when `orderBotEnabled` | Do not invent Rubika webhook |
| **TELEGRAM** (slice 3 code, OFF) | from settings | Design: Worker-forwarded webhook + `secret_token` | Same pattern | **No egress/Worker change**; flag OFF |

Public routes (unauthenticated, secret-validated):

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/v1/omnichannel/bots/bale/webhook` | Bale updates; validate secret; idempotent ingest |
| POST | `/v1/omnichannel/bots/telegram/webhook` | Stub/handler behind OFF flag (no Worker change required to merge) |
| — | Rubika | No public webhook; internal poller |

Admin (JWT + omnichannel RBAC):

| Method | Path | Role | Purpose |
| --- | --- | --- | --- |
| GET | `/v1/omnichannel/bots/inbox` | VIEWER+ | List conversations: provider, customer label, last message, autoReplyAt, tags (`sensitive`, `unanswered`), order/PFI refs |
| GET | `/v1/omnichannel/bots/inbox/:conversationId` | VIEWER+ | Thread + linked order/invoice |
| POST | `/v1/omnichannel/bots/inbox/:conversationId/reply` | PUBLISHER+ | Admin reply → adapter sendMessage (bot enabled **or** Owner+goRef support-only) |
| POST | `/v1/omnichannel/bots/inbox/:conversationId/refer-social` | PUBLISHER+ | «ارجاع به سوشال مدیا»: forward summary to `ownerChatId`; audit |
| POST | `/v1/omnichannel/bots/inbox/:conversationId/mark-answered` | PUBLISHER+ | Clear unanswered; resolve open PR-13 alert |
| PATCH | `/v1/omnichannel/connections/:id/order-bot` | **OWNER + goRef** | `{ enabled: boolean }` — default false |
| POST | `/v1/omnichannel/destinations/:id/channel-settings/test-owner-chat` | OWNER + goRef | Enable PR-10 stub: one ping to configured `ownerChatId` (live: Bale canary rules only; never invent id) |

### 3.2 Conversation FSM (professional order-taker)

States on `omnichannel_bot_conversations.state` (additive column):

1. `MENU` — welcome + menu: محصولات / سفارش / پیگیری / پشتیبانی  
2. `PRODUCT_LOOKUP` — code or deep-link `start=<SKU>` (REQ-C9); live name/price/stock + minOrderQty  
3. `VARIANT` — color/size from live variants  
4. `QTY` — reject if `qty < minOrderQty`  
5. `CUSTOMER_INFO` — name, phone, city, store name; validate phone; **do not log full PII**  
6. `SUMMARY` — confirm; no fake delivery/discount promises  
7. `PFI_CREATED` — orders + PROFORMA; message `PFI-…`  
8. `SENSITIVE_HOLD` — classifier; expert-follow copy; tag + forward  
9. `SUPPORT` / `TRACK` — track by PFI/order read-only; support → unanswered if no auto answer  

**Auto-reply SLA:** first response to new inbound < **60s** (inline after persist — not publish outbox).

**Deep-link (REQ-C9):** parse `/start SKU` or `start=SKU` / Bale equivalent; jump to PRODUCT_LOOKUP. PR-10 caption CTAs may emit links later — bot must accept now.

**Commerce channel:** default **WHOLESALE** for these order bots. Do **not** rewrite create-order channel from customer type (deferred). Retail-specific bot = follow-up Owner task.

### 3.3 Sensitive classifier (deterministic, no LLM)

Tag «حساس» when any of:

- Explicit intents: اعتبار / چک / نسیه / قیمت ویژه / شکایت / مرجوع  
- First successful order for `(provider, customerChatId)` (no prior `PFI_CREATED` / linked order)  
- Free-text asking below-list / “همکار ویژه” without confirmed partner  

On hit: `SENSITIVE_HOLD`; inbox tag; forward to `ownerChatId`; **no** PFI that turn.

### 3.4 Forwarding

- Unknown free-text outside FSM + all placed orders → compact summary to `ownerChatId` (provider sendMessage).  
- Depends Owner-filled PR-10 ids (never invent).  
- «ارجاع به سوشال مدیا» = same forward + audit `bot_refer_social`.

### 3.5 Rate limit / anti-spam

- Per `(provider, customerChatId)`: N msgs/min; burst → soft block + Persian notice; optional `spam_flag` in tags.  
- Global per-provider webhook QPS.  
- Duplicate text flood → one inbox bump.

## 4. Data model (migrations)

**Additive** migration e.g. `20261030-001-omnichannel-order-bots.ts` — **Iran backup before apply**. **Do not recreate** PR-13 tables; **ALTER** + entity edits.

### 4.1 Extend `omnichannel_bot_conversations`

| Column | Type | Notes |
| --- | --- | --- |
| `connectionId` | uuid nullable FK | bot connection (token/webhook scope) |
| `externalChatId` | varchar nullable | usually = `customerChatId`; keep PR-13 column as SoT for scanner |
| `state` | varchar | FSM; default `MENU` |
| `statePayload` | jsonb | SKU/variant/qty/… — **no tokens** |
| `tags` | jsonb | e.g. `["sensitive"]` |
| `unansweredSince` | timestamptz nullable | human needed; clear on admin reply |
| `autoRepliedAt` | timestamptz nullable | SLA |
| `lastInboundAt` / `lastOutboundAt` | timestamptz nullable | optional; keep writing `lastCustomerMessageAt` / `lastStaffReplyAt` for PR-13 |
| `orderId` / `invoiceId` | uuid nullable | after PFI |

Unique: one **open** row per `(destinationId, customerChatId)` (partial unique where `status='open'`). Align with PR-13 `destinationId` **required**.

### 4.2 Extend `omnichannel_bot_messages`

| Change | Notes |
| --- | --- |
| Keep `direction` | **`inbound` \| `outbound` \| `system`** (already PR-13 — do not rename to in/out) |
| Keep `bodyPreview` | ≤200 for list; optional additive `body` text truncated/masked for thread view |
| `providerMessageId` | use for idempotency; add unique partial `(provider denorm OR via join)` — prefer additive `provider` varchar + unique `(provider, providerMessageId)` where not null |
| `meta` | jsonb nullable — buttons/sku; no secrets |

### 4.3 Connection / settings flags

- `publishSettings.orderBotEnabled` boolean default **false** on `omnichannel_channel_connections` (**D-1** — token/webhook per connection).  
- Poller cursor: `publishSettings.orderBotPollCursor` (Rubika `next_offset_id` / Bale offset) — never a secret.

**No** outbox row DELETE; **no** changes to publication idempotency/HOLD/cap claim.

## 5. File boundaries (`file_claims`)

Preferred branch: `ai/TASK-20261029-pr14-order-bots` · worktree e.g. `D:/proje/Site-B2B-pr14` · **rebase on `origin/master` @ ≥ `ab4019b0`**.

### 5.1 Exclusive (implementer owns)

| File | Action |
| --- | --- |
| `apps/api/src/database/migrations/*-omnichannel-order-bots.ts` | NEW (+ `.spec.ts`) — ALTER PR-13 tables |
| `apps/api/src/modules/omnichannel/bots/bot-inbound-idempotency.ts` | NEW |
| `apps/api/src/modules/omnichannel/bots/bot-inbound-idempotency.spec.ts` | NEW |
| `apps/api/src/modules/omnichannel/bots/bot-order-fsm.ts` | NEW — pure transitions |
| `apps/api/src/modules/omnichannel/bots/bot-order-fsm.spec.ts` | NEW — MOQ reject + sensitive |
| `apps/api/src/modules/omnichannel/bots/bot-sensitive.ts` | NEW |
| `apps/api/src/modules/omnichannel/bots/bot-sensitive.spec.ts` | NEW |
| `apps/api/src/modules/omnichannel/bots/bot-rate-limit.ts` | NEW |
| `apps/api/src/modules/omnichannel/bots/bot-rate-limit.spec.ts` | NEW |
| `apps/api/src/modules/omnichannel/bots/bot-catalog.ts` | NEW — live product/price/stock/minOrderQty |
| `apps/api/src/modules/omnichannel/bots/bot-catalog.spec.ts` | NEW |
| `apps/api/src/modules/omnichannel/bots/bot-pfi.ts` | NEW — OrderService + InvoiceService PROFORMA |
| `apps/api/src/modules/omnichannel/bots/bot-pfi.spec.ts` | NEW |
| `apps/api/src/modules/omnichannel/services/omnichannel-bot-inbox.service.ts` | NEW |
| `apps/api/src/modules/omnichannel/services/omnichannel-bot-inbox.service.spec.ts` | NEW |
| `apps/api/src/modules/omnichannel/services/omnichannel-bot-inbound.service.ts` | NEW |
| `apps/api/src/modules/omnichannel/services/omnichannel-bot-inbound.service.spec.ts` | NEW |
| `apps/api/src/modules/omnichannel/services/omnichannel-bot-poller.service.ts` | NEW — Rubika (+ optional Bale fallback); **no-op when disabled** |
| `apps/api/src/modules/omnichannel/controllers/omnichannel-bot-webhook.controller.ts` | NEW |
| `apps/api/src/modules/omnichannel/dto/omnichannel-bot.dto.ts` | NEW |
| `apps/web/src/components/admin/admin-omnichannel-bot-inbox.tsx` | NEW |
| `apps/web/src/components/admin/admin-omnichannel-bot-inbox.spec.ts` | NEW |
| `docs/design/omnichannel-redesign/pr14-order-bots-plan.md` | THIS plan |
| `docs/reports/2026-xx-omnichannel-pr14-order-bots.md` | NEW at implement time |

### 5.2 Soft-reclaim / thin mounts (after tip; coordinate if other tasks hold)

| File | Action |
| --- | --- |
| `apps/api/src/modules/omnichannel/entities/omnichannel-bot-conversation.entity.ts` | EDIT — additive columns (exists PR-13) |
| `apps/api/src/modules/omnichannel/entities/omnichannel-bot-message.entity.ts` | EDIT — additive columns |
| `apps/api/src/modules/omnichannel/channel-settings.ts` | EDIT — **read-only** consume `ownerChatId*`; no field redesign |
| `apps/api/src/modules/omnichannel/services/omnichannel-alerts.service.ts` | EDIT — resolve/ack hooks from inbox reply; keep scanner contract |
| `apps/api/src/modules/omnichannel/controllers/omnichannel-admin.controller.ts` | EDIT — inbox + order-bot enable + test-owner-chat |
| `apps/api/src/modules/omnichannel/adapters/bale.adapter.ts` | EDIT — **minimal** sendMessage reuse; optional documented webhook helpers; poll ack separate from discoverChats |
| `apps/api/src/modules/omnichannel/adapters/rubika.adapter.ts` | EDIT — **minimal** getUpdates+offset ack for order poller |
| `apps/api/src/modules/omnichannel/adapters/telegram.adapter.ts` | EDIT — **minimal** inbound parse helpers only; **no** `TELEGRAM_API_URL` / egress |
| `apps/api/src/modules/omnichannel/omnichannel.module.ts` | EDIT — register |
| `apps/api/src/modules/omnichannel/omnichannel.constants.ts` | EDIT — `OMNICHANNEL_ORDER_BOT_*` defaults **false** |
| `apps/api/src/modules/omnichannel/omnichannel-rbac.ts` | EDIT — inbox reply / enable Owner gates |
| `apps/api/src/modules/omnichannel/canary-live-guard.ts` | EDIT only if smoke/test-owner needs shared warn (prefer reuse as-is) |
| `apps/web/src/components/admin/AdminOmnichannel.tsx` | EDIT — mount tab «صندوق ربات‌ها» behind flag |
| `apps/web/src/components/admin/admin-omnichannel-channel-settings.tsx` | EDIT — enable «تست owner_chat_id» → new endpoint |
| `.env.example` | EDIT — webhook secret **names**, `OMNICHANNEL_ORDER_BOT_UI`, `OMNICHANNEL_ORDER_BOT_BALE`, `…_RUBIKA`, `…_TELEGRAM` all default false |
| `apps/api/scripts/unit-specs.txt` | EDIT |
| `docs/WORKLOG.md` | EDIT at implement time |
| `.ai-dos/tasks/active.yaml` / `handoff.md` | EDIT — claim/release |

**Do not touch:** `deploy/telegram-egress-worker/**` / Telegram vault move; SMS panel; outbox DELETE; inventing Bale/Rubika methods beyond docs; enabling connectors in CI; blog author channel; rewriting order channel from customer type; mass requeue; FORCE/SKIP_DRAIN; remapping canary `4858359991`.

## 6. Phased slices (implementer)

| Slice | Scope | Exit |
| --- | --- | --- |
| **S0** | ALTER migration + entity extend + idempotency + rate-limit pure units | migrate up/down green locally on tip |
| **S1 Bale inbound** | Webhook (or documented poll) + welcome/menu <1min + write PR-13 timestamps; bot flag OFF | unit + integration ingest idempotent; live OFF |
| **S2 Bale order FSM** | SKU/deep-link → variant → qty≥MOQ → customer → summary → PFI; sensitive | unit MOQ + sensitive; integration PFI in message |
| **S3 Forward + owner test** | Forward unknowns/orders; enable test button; refer-social | needs Owner-filled `ownerChatId` on canary dest |
| **S4 Inbox UI** | Tab: list/filter by channel, sensitive, reply, unanswered, refer | UI flag default false |
| **S5 Rubika** | Poller + same FSM; flag OFF | unit poll cursor; no webhook invention |
| **S6 Telegram code** | Webhook controller + FSM; **`OMNICHANNEL_ORDER_BOT_TELEGRAM=false`**; no Worker/egress change | compile + unit only |
| **S7 PR-13 hook** | Inbound keeps unanswered scanner fed; reply resolves alerts | integration with existing alerts service |
| **S8 Live smoke (Owner)** | Bale canary dual-role peer only; one happy-path PFI; cancel/mark test; leave bots OFF | checklist below |

## 7. Acceptance criteria / tests

**Unit**

1. Idempotent duplicate update id → single message row.  
2. FSM: `qty < minOrderQty` → reject, stay in QTY.  
3. FSM: sensitive keyword → `SENSITIVE_HOLD`, no PFI.  
4. Catalog: live projection only (no legacy `stock` write).  
5. Rate limit trip → no FSM advance.  
6. Enable order bot without goRef → 403 when RBAC on.  
7. Logs/audit fixtures contain no token-shaped strings.  
8. Canary guard: documented Bale dual-role never auto-cleared by bot enable path.

**Integration**

9. Webhook bad secret → 401/403; good secret + duplicate bodies → one conversation message.  
10. Happy path Bale fixture → order + `PFI-*` linked.  
11. Sensitive → tag + forward when ownerChatId set; skip+audit when missing.  
12. Poller no-op when `orderBotEnabled=false`.  
13. Inbound sets `lastCustomerMessageAt`; admin reply updates `lastStaffReplyAt` and resolves open unanswered alert.

**Live smoke (Owner-gated, Bale canary `4858359991` only — dual-role warn, no remap)**

14. Briefly enable Bale order bot with goRef → one scripted DM → menu <60s → test PFI → **cancel/mark test** → disable → confirm OFF.  
15. Zero production channel posts; Telegram/Rubika live remain OFF.  
16. No FORCE/SKIP_DRAIN.

Pass bar: omnichannel bot unit specs green + `tsc` clean; bots **OFF** after green.

## 8. Must-do vs owner-gated

| Must-do (CODE implementer) | Owner-gated |
| --- | --- |
| S0–S6 behind flags default false | Written GO before merge/deploy |
| Unit/integration incl. MOQ + sensitive | Iran DB backup before migration |
| Inbox UI flag off | Fill real `ownerChatId` / order-bot ids per channel (PR-10) |
| Telegram code present but OFF | Enable Bale bot **briefly** for canary smoke only |
| Wire PR-13 unanswered coexistence | Confirm/cancel test PFI; leave bots OFF |
| WORKLOG + report | Rubika/Telegram enable = separate GO |
| Reuse canary-live-guard (no remap) | No personal Hamed DM; SM path for sensitive |
| | No `TARANOM_DEPLOY_FORCE` / `SKIP_DRAIN` |

## 9. Rollback

1. Set all `OMNICHANNEL_ORDER_BOT_*` + UI flags **false**; Owner PATCH `orderBotEnabled=false`.  
2. Stop poller; deleteWebhook on Bale only if documented and was registered.  
3. Revert PR; ALTER columns additive — leave or down().  
4. Cancel test PFIs. Publish + PR-13 alerts pipeline unaffected if inbound stopped.

## 10. Dependencies & start gate

| Dependency | Why | Status |
| --- | --- | --- |
| **PR-10** | `ownerChatId` + settings UX + test button stub | **Merged #142** |
| **PR-13** | conversation/message tables + unanswered scanner | **Merged #146** tip `ab4019b0` |
| **PR-6** | Owner + goRef enable | Assumed on tip |
| **PR-15** | Preferred before merge (god-service) | Soft |
| **PR-12 Telegram** | **Non-goal** — do not wait; do not change Telegram egress | Bale/Rubika vault already merged |
| **Iran deploy of tip** | PR-13 mig `20261029-002` must exist on Iran before PR-14 ALTER / live smoke | **Confirm before Iran migrate** |
| Publish soak | Queue: bots after channel publish stabilized | Soft |

**Implementer start rule**

- **CODE (flags OFF) may start** after: Owner **implement GO** + rebase on tip ≥ `ab4019b0` + claim files. Does **not** require Iran deploy to begin S0–S6.  
- **Iran migrate / live smoke** blocked until: tip (incl. PR-13 tables) is on Iran with listable backup, then PR-14 ALTER, then brief Bale canary, then bots OFF.  
- This architect pass: **plan only** — no implement, no PR, no deploy, bots stay OFF.

## 11. Non-goals / hard stops

- `TARANOM_DEPLOY_FORCE` / `SKIP_DRAIN`  
- Changing Telegram egress Worker / `TELEGRAM_API_URL` / Telegram vault  
- Inventing Rubika webhook or undocumented Bale methods  
- Inventing destination/chat IDs  
- Clearing/remapping canary on `4858359991`  
- Real-channel delete/edit  
- SMS  
- Enabling bots by default or leaving them ON after smoke  
- Messaging Hamed’s personal chat from code  
- Stock writes from bot  
- Fake delivery/discount promises  
- Outbox row DELETE / mass DEAD retry  
- Recreating PR-13 tables under new names  
- Blog author `channel=` / `apps/web/src/lib/blog.ts`  
- Rewriting create-order channel from customer type (later)

## 12. Open decisions (safe defaults)

| # | Question | Recommended default |
| --- | --- | --- |
| D-1 | orderBotEnabled storage | Connection `publishSettings.orderBotEnabled` |
| D-2 | Bale webhook vs poll | Webhook if docs confirm; else poll with ack |
| D-3 | Commerce channel | WHOLESALE for all three order bots |
| D-4 | First-order sensitive | Yes — first PFI-less conversation treated sensitive until Owner says otherwise |
| D-5 | Admin reply when bot OFF | Owner+goRef only |
| D-6 | PII storage | Keep `bodyPreview`; optional masked `body`; mask phone mid-digits in logs |
| D-7 | Deep-link alphabet | Accept Persian/Latin digits SKU normalize |
| D-8 | Schema strategy | **ALTER PR-13 entities** — never parallel `bot_conversation` rename |
| D-9 | test-owner-chat live target | Send only to Owner-configured `ownerChatId`; if empty → 400; canary dual-role warn if dest is `4858359991` |

## 13. Sequence (when CODE GO)

0. Confirm local/worktree on tip ≥ `ab4019b0`; confirm Iran has PR-13 mig before any Iran ALTER.  
1. Claim exclusive §5.1 files; soft-reclaim §5.2 after coordinating stale holds.  
2. S0 → S1 → S2 → S3 → S4 → S5 → S6 → S7.  
3. CI green; **do not** enable bots.  
4. Owner: backup → migrate Iran → brief Bale canary smoke → cancel test PFI → bots OFF.  
5. Telegram live phase = separate GO.

## 14. Validation checklist (pre-merge)

- [ ] Unit specs listed in `unit-specs.txt` green  
- [ ] `tsc` api+web clean  
- [ ] Flags default false in `.env.example`  
- [ ] No Telegram egress / vault Telegram diffs  
- [ ] No canary remap of `4858359991`  
- [ ] PR-13 alert scanner still evaluates open conversations  
- [ ] Report + WORKLOG ready for Owner GO merge/deploy  
