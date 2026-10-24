# Omnichannel — Server Error + Bale DEAD revive (2026-10-24)

## Symptoms (admin `/admin/omnichannel`)

- Pink banner «خطای سرور»
- Attention: ~36 failed sends + ~38 stopped outbox events
- Destination filter pointed at Bale wholesale canary «کانال عمده بله (تست)»

## Root cause

1. **Banner «خطای سرور»** — `api.ts` maps non-JSON / empty 5xx (typical nginx 502 while `api`/`web` recreate during deploy) to that string. Live GETs for status/connections/destinations/templates/publications/deliveries/outbox/audits (with Bale `destinationId`) all return 200 when the API is healthy. Audits jsonb `?` was hardened to `jsonb_exists` anyway.
2. **36 / 38 counters** — production had **33 DEAD** `publication.deliver.requested` rows (and matching deliveries) with  
   `BALE connector is disabled (OMNICHANNEL_CONNECTORS_ENABLED / OMNICHANNEL_DISABLED_PROVIDERS)`.  
   Global connectors are **on** now; `BALE_BOT_TOKEN` lives in vault `omnichannel.secret.vault`. Those rows stayed DEAD because the worker treated `ConnectorDisabledError` like a hard failure (burned attempts) instead of deferring like the global connectors-off path.
3. **JWT footgun** — invalid `sub` caused Postgres `invalid input syntax for type uuid` → Nest 500 (also surfaces as «خطای سرور»). Now 401.

## Fix

| Layer | Change |
| --- | --- |
| Worker | `ConnectorDisabledError` → `DeliveryDeferredError` (no DEAD burn) |
| API | `POST /omnichannel/outbox/revive-connector-disabled` soft-requeues DEAD gate-off events + deliveries |
| Audits | `jsonb_exists(...)` instead of jsonb `?` |
| JWT | UUID guard on `sub` before `findById` |
| Admin UI | Separate attention for gate-off DEAD + «بازتلاش همین‌ها»; softer load for audits; clearer 502 copy |

## Dependencies checked (Iran)

- `OMNICHANNEL_CONNECTORS_ENABLED=true`, `OMNICHANNEL_AUTO_PUBLISH=true`
- Vault entries: `BALE_BOT_TOKEN`, `RUBIKA_BOT_TOKEN`; env has `TELEGRAM_BOT_TOKEN`
- Destinations: Telegram live, Bale canary verified, Rubika canary verified
- Worker hydrates vault via `OmnichannelTokenVaultService.refreshIfStale`

## Ops after deploy

1. Hard-refresh `/admin/omnichannel`
2. Click «بازتلاش همین‌ها» (or call revive endpoint)
3. Confirm DEAD channel count drops and Bale deliveries leave PENDING → SUCCEEDED
