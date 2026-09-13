# Admin settings workspace — 2026-09-13

## Outcome

`/admin/settings` is a URL workspace (`?section=&channel=&q=`). Nine sections are complete. Save reloads the server payload and revalidates retail + wholesale chrome so NAP, menus, titles, OG, and Organization JSON-LD stay in sync.

## Research

- Saleor `shopSettingsUpdate`: one shop write + side effect. Applied as group PUT + chrome revalidate.
- Medusa sales channels: channel-split methods/pixels; shared brand/SMS secret.
- Shopify Settings IA: job groups, not one form.
- Ghost/Payload (blog workspace): query string is SoT.
- Google Organization + image alt: visible NAP/logo/alt; no `llms.txt`; FAQ rich results retired May 2026.
- Slack public search: no settings decisions.

Product per-image `imageAlts` was already live (TASK-20260913-010). Not reopened.

## What changed

- New `seo` settings group (title/description/OG + alt per channel).
- Business: logo, logo alt, channel descriptions, sameAs.
- SMS fulfillment events survive save.
- Installments: min active invoices + amount floor.
- Menus embedded in settings; sidebar points at `?section=navigation`.
- Public settings + layouts feed Organization/WebSite JSON-LD and default metadata.
- `settings:{channel}` cache tag busts Next fetch of `/settings/public`.

## Verification

Specs and tsc recorded in handoff after run.

Live VPS `696f6e8` (auto-deploy exit 0):

| Check | Result |
|---|---|
| API `/v1/health` | 200 `{"status":"ok","service":"taranom-api","version":"1.0"}` |
| `.com` home | 200 ~1.77s; ClothingStore + WebSite + `#organization` + ImageObject caption |
| `.ir` home | 200 ~1.77s; OnlineStore + parent Organization + WebSite |
| `/settings/public` both channels | 200; includes `seo`; no merchantId/apiKey/secret/token/postback |
| `/admin/settings` | 200 login (`redirect=/admin/settings`); click/save not exercised |
