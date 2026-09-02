---
name: omnichannel
description: Continue Omnichannel phases 0–8 on the shared retail/wholesale monolith. Use when working on outbox, worker, channel stock, Feed/Basalam, Telegram canary, OOS policy, CMS channel, or admin /omnichannel.
paths: apps/api/src/modules/{omnichannel,product,inventory,order,feeds,basalam,cms}/**/*.{ts,tsx}
---

# Omnichannel

This is one Modular Monolith. Do not add a second API, database, inventory source, or bot backend.

Load first: `.cursor/rules/05-omnichannel.mdc`, `.cursor/agents/omnichannel-architect.md`, `docs/reports/2026-08-29-omnichannel-phases-4-8.md`.

## Phase order

0 correctness → 1 schema → 2 outbox → 3 worker → 4 Retail projection → 5 Wholesale projection → 6 gated adapters → 7 Admin/reconcile → 8 deploy hardening.

Do not skip ahead to live Telegram. Destination canary and connector flags are owner-gated.

## Invariants

- Retail uses only `retailStock` / `retailPrice` / `retailSalePrice` / `showOnRetail`.
- Wholesale uses only `wholesaleStock` / `wholesalePrice` / `wholesaleSalePrice` / `showOnWholesale`.
- Never read legacy `stock` in Feed, Basalam, storefront, or omnichannel projection.
- Only Inventory/Order change stock. Connectors never decrement stock.
- Side effects go through transactional outbox + worker. Secrets are `secretRef` (env name) only.
- Unchosen admin settings display a default and must not change live delivery.
- Never DELETE outbox rows. Reset stuck work with PENDING + attempts=0 after a persist/lease fix.

## Hard stops

- Do not set `OMNICHANNEL_CONNECTORS_ENABLED=true` or `OMNICHANNEL_AUTO_PUBLISH=true` unless the owner explicitly orders that step in this chat.
- Do not invent Bale/Rubika APIs. Telegram is `api.telegram.org` only.
- Do not guess remaining §9 values (MOQ policy, which edits auto-publish, retry SLA, CMS routes, retention) into live worker behavior. Store them like OOS (`*Chosen`).

## Load next

- [references/invariants.md](references/invariants.md)
- [references/phase-order.md](references/phase-order.md)
- [references/section-9-leftovers.md](references/section-9-leftovers.md)
- [references/acceptance-checklist.md](references/acceptance-checklist.md)

## Related slashes

`/omnichannel` `/omnichannel-next` `/omnichannel-architect` `/omnichannel-review` `/omnichannel-security` `/omnichannel-ops`
