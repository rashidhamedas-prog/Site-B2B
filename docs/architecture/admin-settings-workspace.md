# Admin settings workspace

Confirmed 2026-09-13. Completes `/admin/settings` without a second config service.

## Facts

- One JSON `app_settings` row per group (`business`, `shipping`, `sms`, `payment`, `installments`, `theme`, `menus`, `marketing`, `smsOps`, `shippingPost`). Admin GET already returns all of them; the UI only edited seven tabs and never persisted `menus`.
- Footer chrome lives in CMS (`/admin/site-content`). Contact facts (name, phone, email, addresses, Enamad) live in settings. Organization / WebSite JSON-LD and some layout titles were hardcoded, so admin saves did not sync to search.
- Public `GET /settings/public` is cached (API 30/60/300 + Next 120s). Save updated the in-memory API cache for that key only and did not revalidate storefront chrome except on CMS pages.
- SMS load dropped `fulfillment*` event keys; a later save could restore them to the getter default (`true`).
- Product per-image `imageAlts` is already the catalog SoT (TASK-20260913-010). This workspace does not reopen that form.

## Research used (not installed)

| Source | Takeaway applied here |
| --- | --- |
| [Saleor shopSettingsUpdate](https://docs.saleor.io/api-reference/shop/mutations/shop-settings-update) + dashboard Site Settings | One shop mutation; update emits a side-effect. Our side-effect is cache bust + chrome revalidate, not a new webhook bus |
| [Medusa sales channels / regions](https://docs.medusajs.com/resources/recipes/multi-region-store) | Channel is the split key. Shared secrets (sms.ir, brand legal name) stay once; prices/methods/pixels split |
| Shopify Settings IA | Job groups: store details, shipping, payments, notifications, apps/pixels, legal/nav — not one endless form |
| WooCommerce General vs Products vs Shipping vs Payments | Identity ≠ catalog. Product alts stay on the product |
| Ghost/Payload locale switcher (blog workspace) | `?section=&channel=` is the workspace SoT |
| Google Organization + image alt | Visible NAP, `sameAs`, logo, and `ImageObject` must match the page. No `llms.txt` / FAQ rich-result promise (Google 2026-07-10 / FAQ retired 2026-05-07) |

Slack public search on 2026-09-13 returned no settings-workspace decisions.

## Decisions

1. Workspace query: `?section=business&channel=RETAIL`. Defaults: هویت + عمده.
2. Nine sections: هویت، ناوبری، ارسال، پیامک، پرداخت، اقساط، سئو، پیکسل، ظاهر.
3. Save writes only the active section (plus its sidecar: `smsOps`, `shippingPost`). Then reload admin payload and revalidate retail + wholesale chrome.
4. New `seo` JSON group holds default title/description/OG per channel. Business gains `logoUrl`, `logoAlt`, and channel descriptions. GSC tokens stay in `marketing` (already public-safe).
5. Organization / WebSite JSON-LD and layout metadata read public settings with the current hardcoded strings as fallback. `paymentAccepted` follows cash flags.
6. Menus stay the existing nested `{ wholesale, retail }` write. Settings embeds the same editor so one channel cannot overwrite the other.
7. No Saleor/Medusa/Shopify install, no new microservice, no `llms.txt`.

## Non-goals

- Moving footer copy out of CMS chrome
- New payment or SMS providers
- Live GSC / Merchant Center writes
- Changing public URL patterns
- Replacing product `imageAlts`

## Ownership

| Surface | Channel scoped | Owner |
| --- | --- | --- |
| Settings sections, save+reload, SEO group, business logo/descriptions | mixed | this workspace |
| Public settings + Organization/WebSite JSON-LD + default metadata | yes | this workspace |
| Menus editor | yes | this workspace UI + existing menus PUT |
| Product gallery alts | per product | TASK-20260913-010 (already live) |
| CMS chrome / page bodies | yes | `/admin/site-content` |

## Assumptions

- One settings document already serves both storefronts; a second config DB is not required.
- Door cash / IN_PERSON remain opt-in (TASK-20260913-005/006). This task does not change those defaults.
- Slack had no conflicting settings IA.

## System context

Actors: owner/admin (ADMIN JWT + AdminOnly), retail shopper (`.ir`), wholesale buyer (`.com`), Googlebot / OG scrapers.

Trust boundary: `/settings/admin*` stays admin-guarded. Public read never returns API keys, postbacks, or payment secrets. Logo/OG/sameAs URLs are allowlisted (`/` or `https:`).

## API / save contract

- `GET /settings/admin` returns existing groups plus resolved `seo`.
- `PUT /settings/admin/:group` allowlist adds `seo`. Business/seo writes sanitize URLs and strip tags.
- `GET /settings/public` exposes business identity + seo titles/OG (no secrets).
- Rollback: unused `seo` keys are ignored by readers; JSON-LD falls back to current copy.

## Critical sequence

```text
Admin edits a section
  → PUT that group only
  → in-memory settings cache updated
  → GET admin reload (UI matches server)
  → revalidate chrome on .ir and .com
  → next public fetch sees logo/NAP/title/OG
  → Organization JSON-LD and layout metadata read the same public object
```

## Security

- Admin auth unchanged; no new public write.
- Secrets stay on admin GET; empty payment secret fields still preserve the previous stored value.
- Asset URLs reject `javascript:`, `data:`, and protocol-relative hosts.
- Descriptions/titles/alts strip HTML, max 200/70/160 chars.

## Invariants

- Retail and wholesale channel objects are never replaced by a flat wholesale payload.
- Saving SMS keeps every known event key.
- Organization telephone/email/name/logo match public business fields or the documented fallback.
- Product image alt remains per gallery URL on the product, not a settings field.

## Rollout

Live on `origin/master` + VPS `696f6e8`. Rollback: revert merge `696f6e8` / feat `21bfb20`. No migration.
