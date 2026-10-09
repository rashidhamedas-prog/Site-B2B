# GA4 validation after the code change

Date: 2026-10-10. This is not a production DebugView pass. The change is local until it is deployed.

## Executed

- `npx tsx apps/web/src/lib/retail-analytics.spec.ts` → `retail-analytics.spec.ts ok`
- `npx tsc --noEmit -p apps/web` → exit 0
- Windsor retail property `547378194` still shows the pre-fix outage (see `GA4-AUDIT-BEFORE.md`). October 1–9 has no `page_view`.

## Spec coverage

- IRR is not converted to toman.
- SKU wins over product id. Brand is `Taranom`.
- Query allowlist drops `Authority`, `otp`, `phone`, and unknown keys.
- Event params drop phone and email keys.
- Search term that looks like a mobile number is not sent.
- gtag queue entry is an Arguments object, not an Array.
- Two `trackPurchase` calls with `RT-DEDUP` produce one `purchase` dataLayer event.
- `contact_click` sends `contact_method=whatsapp` only.

## Not executed

- Playwright shopper flow. No sandbox payment was run.
- Tag Assistant, DebugView, and a mobile Safari pass.
- Lighthouse before/after. The diff adds no script and no `useSearchParams`. A full Lighthouse run was not done.
- Live `g/collect` count on production.

## Acceptance

| Criterion | Status | Evidence |
|---|---|---|
| One page_view per final load or route | BLOCKED | Code dedupes id+path. Not observed in a browser. |
| Initial, navigation, back/forward, refresh tested | BLOCKED | No browser pass. |
| No second GA/GTM loader | PASS | Direct gtag.js still not injected. |
| Wholesale id not used on retail events | PASS | `send_to` uses the channel id; ecommerce helper is retail-host only. |
| view_item_list, select_item, view_item | BLOCKED | view_item and list already called. select_item not wired. |
| add_to_cart, remove_from_cart, view_cart | PASS | Existing call sites kept. Spec does not browser-fire them. |
| begin_checkout, shipping, payment info | PASS | Existing checkout calls kept. |
| purchase once after verify | BLOCKED | Client dedupe proven in spec. Server MP and gateway retry not retested. |
| Stable transaction id | PASS | Payload uses the given id. |
| Revenue currency IRR | PASS | Spec. |
| Item id, name, brand, variant, price, quantity | PASS | Spec. |
| Partner signup and login measurable | BLOCKED | Helpers only. |
| No PII in GA4 params | PASS | Allowlist and param sanitizer spec. Callback URL still needs the panel redact. |
| Payment referrals | BLOCKED | Checklist only. Panel not changed. |
| UTM standard documented | PASS | `UTM-STANDARD.md` |
| Dev and Tag Assistant stay out of production | BLOCKED | Dev hosts already skip tags. Tag Assistant filter is a panel step. |
| Lint, types, unit, integration, e2e, build | BLOCKED | Unit spec and web tsc passed. Integration, e2e, and production build were not run. |
| No CWV regression | BLOCKED | No Lighthouse. |
| Docs delivered | PASS | This folder. |
| Before/after evidence | BLOCKED | Before is Windsor. After needs 24–48h post-deploy. |

## 24 hours and 7 days

After deploy, check DebugView for one `page_view` on `/` and one more on a product URL. Then Windsor, retail property only:

- Daily `page_view` should be non-zero on the next full day.
- `view_item` and `add_to_cart` should appear when those pages are used.
- `purchase` should equal paid retail orders, not exceed them.
- Landing page `(not set)` should fall for new sessions. It will not hit zero.
