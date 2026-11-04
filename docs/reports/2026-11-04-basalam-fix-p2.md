# Basalam fix P2 — dry-run mode + injectable HTTP port

Branch `ai/basalam-fix-p2` (stacked on P1). No deploy, no live Basalam calls.

## Change
- `basalam-http.ts`: `BasalamHttp` port (`request` JSON/FormData, `download` binary), DI token `BASALAM_HTTP`, default `FetchBasalamHttp`. All Basalam service traffic (users/me, stall list, categories, photo download/upload, create, bulk + fallback PATCH) goes through it.
- `POST /v1/basalam/push-catalog?dryRun=1` and `POST /v1/basalam/sync-inventory?dryRun=1` (ADMIN only, same guards): build payloads and return them; zero HTTP, no photo upload (photos are source URLs), no `persistProductMap`, no in-flight lock. Works when integration is disabled or token missing; response only exposes `config.{enabled, hasToken, vendorId}`.
- Dry-run push does not evaluate stall matching or category lookup (both remote reads) → `category_id: null` + note. Variants preview lists size/color/retailStock only.

## Tests
`basalam.service.spec.ts`: zero port calls and zero global `fetch` in dry-run; map/settings untouched; `primary_price` Rial; stock = retail sum (wholesale/legacy ignored); photos as URLs; token absent from response and stdout/stderr; missing photo reported; real sync/push route through the port.
