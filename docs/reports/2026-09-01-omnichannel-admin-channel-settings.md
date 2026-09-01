# Omnichannel Admin channel settings (2026-09-01)

## Scope

Store the three owner choices needed to continue phases 4–6, without enabling connectors or sending Telegram.

| Choice | Storage | Default |
|---|---|---|
| Retail/Wholesale OOS | `app_settings.key=omnichannel` | Display `UPDATE`; remote apply only after Admin save (`*OosChosen`) |
| Telegram canary | `omnichannel_channel_destinations.settings.isCanary` | Unset → enqueue zero destinations |
| `secretRef` | existing connection column | Env name only; create stays `DISABLED` |

No new table. No migration. `/admin/settings` is not used.

## Behavior

- Preview annotates `oosPolicy`, `oosPolicySource`, `oosRemoteAction`, `available`, `stock` (channel stock only).
- Catalog sync still writes local publication rows only. HIDE/DELETE + OOS can skip or locally withdraw; it never enqueues.
- `enqueueTelegramDeliveries` targets only the TELEGRAM canary of that channel. Canary unset → 0 rows even if flags were later true.
- Second Telegram canary on the same channel is `409`.
- GET destinations returns `isCanary`, never raw `settings`.
- Telegram HIDE later maps to `editMessageText` (no hide API). DELETE maps to `deleteMessage`. Not activated in this slice.

## Not done

- Live Telegram send / soak / owner enable of `OMNICHANNEL_CONNECTORS_ENABLED` or `OMNICHANNEL_AUTO_PUBLISH`
- Bot + VPS env (required only before first live send)
- §9 leftovers: MOQ, which edits auto-publish, retry SLA, CMS public routes, retention
- Independent Security review

## Rollback

1. `DELETE FROM app_settings WHERE key = 'omnichannel';`
2. `UPDATE omnichannel_channel_destinations SET settings = settings - 'isCanary';`
3. Revert this commit. Do not DELETE outbox rows.
