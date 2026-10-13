# Omnichannel channel publish DEAD — RCA + root fix (2026-10-13)

## Symptom

Admin `/admin/omnichannel` → انتشار: **۱۰ ارسال ناموفق** + **۱۰ رویداد متوقف** کانال.
Caption UI: ۵ مورد عمدی (لغو ادمین / withdraw).

## Live evidence (VPS `42dad75`)

| Signal | Value |
| --- | --- |
| Outbox | DEAD 55 / PENDING 21 / DONE 3074 |
| DEAD by type | `order.status_changed.notification` 38, `publication.deliver.requested` 10, `order.created.notification` 7 |
| Channel DEAD lastError | all 10 → `validate_failed` (WHOLESALE CREATE → `@toliditaranom`) |
| Deliveries DEAD | 10 `validate_failed` + 3 `cancelled_by_admin` + 2 `publication_withdrawn` |
| Flags | connectors=true, auto_publish=true; workers healthy |
| Env `TELEGRAM_BOT_TOKEN` | API returns **401 Unauthorized** (stale); vault still used for successful posts |

### Correlation (channel)

| status | photos | captionAbove | n |
| --- | --- | --- | --- |
| DEAD | 2–5 | true | 10 |
| SUCCEEDED | 1 | true | 6 |
| SUCCEEDED | 2 | false | 1 |
| SUCCEEDED | 0 | * | 15 |

No successful album (`photos >= 2`) with `captionAbove=true`.

Non-channel: 45 DEAD with `operator does not exist: uuid = character varying` from `orders.findOne({ id: string })`.

## Root causes

1. **Album + `show_caption_above_media`** — `TelegramAdapter.create` put `show_caption_above_media` on `sendMediaGroup` InputMediaPhoto. Live data: every multi-photo CREATE with that flag DEAD-lettered as `validate_failed`; single `sendPhoto` with the same flag succeeded.
2. **Opaque errors** — `telegramCall` threw `new Error('validate_failed')`, so `lastError` never stored Telegram’s description.
3. **Order SMS outbox** — `handleOrderStatus` / fulfillment shipped used TypeORM `findOne` on uuid PKs without `::text` cast → Postgres operator error → DEAD (not shown in channel AttentionStrip, but inflated `dead=55`).

## Fix (CODE)

- `telegram.adapter.ts`: omit `show_caption_above_media` for albums; keep it on `sendPhoto`; persist description when code is `validate_failed`.
- `telegram-errors.ts`: `safeWorkerError` / `classifyTelegramThrow` prefer `description` + `telegramCode`.
- `outbox-worker.service.ts`: order status + fulfillment shipped use `findOrderById` / `findCustomerById`.

## Follow-up (same session)

Order SMS DEAD used the same outbox: `orders.customerId` is **uuid** but marketing `settledOrders` / QBs bound varchar → `uuid = character varying`. Fixed entity + `::text` casts + worker isolates marketing from SMS ACK (`7395b646`).

## Live proof after deploy + soft requeue

| Metric | Before | After |
| --- | --- | --- |
| Channel delivery SUCCEEDED | 22–23 | **34** |
| Channel DEAD (real) | 10 `validate_failed` | **0** |
| Channel DEAD (intentional) | 5 | 5 (`cancelled_by_admin` / `publication_withdrawn`) |
| Order.* outbox | 45 DEAD uuid | **139 DONE**, 0 uuid errors |

## Owner ops

1. Hard-refresh `/admin/omnichannel` → صف و حسابرسی (نشان «ارسال ناموفق» باید خالی از خطای واقعی باشد).
2. Optionally refresh env `TELEGRAM_BOT_TOKEN` to match vault (env alone was 401).
3. Do not flip connector flags.
