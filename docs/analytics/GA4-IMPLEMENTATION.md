# GA4 implementation

Retail only. GTM stays the only loader. The app does not inject `gtag.js`.

## Choice

GTM is already the production loader (`DeferredGtm` + container id from env, with retail default `GTM-NKBCGQJV`). A second direct Google tag would double session and page hits. Events are sent as gtag commands on the dataLayer so the container's Google tag can record them without a parallel loader.

## What changed

- `ensureGtagStub` queues `arguments`, which GTM can replay.
- `GoogleAnalytics` sends one `page_view` per measurement id + public path. It does not also push a dataLayer object named `page_view`.
- The first config for an id sets `send_page_view: false`, then the tracker sends the manual hit after paint so `page_title` matches the new route.
- Page paths keep an allowlist of marketing and catalog query keys. Payment `Authority`, phone, email, otp, and token query keys are dropped. Hash is not appended.
- Ecommerce commands include `send_to` when the retail measurement id is known.
- New helpers: `select_item`, `add_to_wishlist`, `search`, `contact_click`, `sign_up` / `login` with `method: sales_partner`, and the affiliate event names.
- Wired now: wishlist add, partner catalog first view, partner link copy, and contact clicks on `tel:`, SMS, WhatsApp, Telegram, Instagram, Rubika, and Bale. The click listener does not send the href or phone number.
- Purchase stays client-side, after payment verify, with the existing transaction-id dedupe.

## Not wired in this change

- `select_item` and `search` are implemented and tested as functions. Product cards and the retail catalog are claimed by in-progress `TASK-20261006-001`, so those call sites were not edited.
- Partner `sign_up` / `login` helpers are ready. Auth pages were not edited.
- Server Measurement Protocol is not hooked. There is no `GA4_MP_API_SECRET`. Needed server env names, neither `NEXT_PUBLIC_`: `GA4_MP_API_SECRET` and `GA4_MP_MEASUREMENT_ID`. A missing secret must skip the send. Payment success must not roll back if GA4 fails. Do not add the secret to git.

## Currency

Stored amounts are IRR. `ga4ValueFromStoredIrr` rounds and sends that number with `IRR`. It does not multiply or divide by 10.

## Performance

No second script tag. No `useSearchParams` (that previously forced the retail layout dynamic). One capture click listener on the retail analytics component. GTM remains deferred.
