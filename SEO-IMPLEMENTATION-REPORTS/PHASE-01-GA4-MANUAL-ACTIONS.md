# PHASE-01 GA4 MANUAL ACTIONS

Property: retail web stream for `https://www.poshaktaranom.ir`  
Measurement ID (from `docs/GOOGLE-SETUP.md`): `G-F2V7VSJMLE`  
GTM: `GTM-NKBCGQJV`

Cursor cannot change the GA4 or GTM Admin UI. Do these after deploy.

## 1. Realtime check (after deploy)

In an incognito window (adblock off), open `https://www.poshaktaranom.ir`.

GA4 → Reports → Realtime, confirm:

| Action | Event |
|--------|--------|
| Open a product | `view_item` |
| Add to cart | `add_to_cart` |
| Open cart drawer | `view_cart` |
| Open `/checkout` | `begin_checkout` |
| Complete a **real** paid/COD order | `purchase` with `transaction_id` |

Confirm page paths are `/products`, `/checkout`, etc. — **not** `/retail/products` and **not** `/admin/...`.

Do **not** place a test order with a real card if you only need event presence; COD thank-you still fires `purchase` for cash orders.

## 2. Key events

Admin → Events:

1. Mark **`purchase`** as a Key event if it is not already.
2. Do **not** mark every ecommerce event as a key event.
3. Optionally mark `begin_checkout` only if you need a funnel conversion besides purchase.

## 3. Stop duplicate initial page_view (GTM)

This repo sends SPA `page_view` via `gtag` with `send_page_view: false` on the direct config.

In GTM (`GTM-NKBCGQJV`):

1. Open the **Google Tag** / GA4 Configuration tag for `G-F2V7VSJMLE`.
2. Set **Send a page view event when this configuration loads** to **false** (or pause a separate GA4 Event tag named `page_view` that fires on All Pages).
3. Submit / Publish.

Until that is done, the first hit of a full page load can still appear twice (GTM + app). SPA navigations are app-only.

Do **not** add a second GA4 Event tag that also fires on dataLayer `event: purchase` — the app already sends `purchase` via `gtag` + `ecommerce`.

## 4. Search Console

If the GA4 property is not linked: GA4 Admin → Product links → Search Console → Link the URL-prefix property `https://www.poshaktaranom.ir`.

## 5. DebugView without polluting production

- Chrome: install [Google Analytics Debugger](https://chrome.google.com/webstore) **or** append `?debug_mode=1` only on a device you control.
- GA4 → Admin → DebugView.
- Do not leave debug_mode on public ads/campaign URLs.
- Prefer a GA4 **internal traffic** filter in Testing (below) over debugging on shared office IPs in production reports.

## 6. Internal traffic (do not hardcode IPs in the website)

1. GA4 Admin → Data streams → the retail web stream → Configure tag settings → Show all → Define internal traffic.
2. Create a rule (e.g. office / home public IP, `traffic_type = internal`).
3. Admin → Data settings → Data filters → Create filter → Internal traffic.
4. Leave the filter in **Testing** first. Confirm in Realtime that test hits get `test_filter` / `internal`.
5. Only then set **Active**.

**Warning:** an Active exclude filter **permanently drops** matching events. They cannot be recovered. Never activate until Testing looks correct. Do not use this to hide `/admin` — the site now skips admin GTM/GA4 in code.

## 7. What not to do

- Do not reuse the wholesale measurement ID (`G-YVT5DXZF5Z`) on `.ir`.
- Do not mark `view_item`, `add_to_cart`, `view_cart` as key events unless a specific report needs them.
- Do not send extra user IDs, emails, or phones in GTM variables.
