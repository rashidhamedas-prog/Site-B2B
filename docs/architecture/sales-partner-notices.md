# Sales partner notices

Status: implemented locally, not deployed  
Date: 2026-10-06

## Decision

Admins need to tell every active sales partner about any topic, and the partner must actually see it inside their own panel.

The 2026 split between a toast, a personal inbox, and a broadcast banner is the right shape. This feature is the banner plus a short inbox. It is not email, SMS, or a public storefront ticker.

Novu, Knock, and Courier were compared and not added. The audience is the active partner list already in Postgres, the message is plain text, and a third-party inbox would add a vendor, a secret, and a second source of truth.

## Behavior

- Admin writes a title, body, importance (`info`, `important`, `urgent`), an optional `/` or `https` link, and an optional last day.
- Publish stores one notice and the count of `ACTIVE` partners at that moment.
- Every active partner who opens the panel sees the highest-priority undismissed notice above the page until they choose «خواندم».
- Dismissal is stored per partner. It is not a browser cookie.
- A partner approved later still sees a notice that has not expired and has not been removed.
- Admin sees how many partners have seen it and how many closed it.
- Removing a notice hides it immediately. Receipts stay.

## Boundaries

- Pending, suspended, and closed partners do not get the panel, so they are outside the audience.
- Body is plain text. Markup is stripped. Links cannot be `javascript:`, `http:`, or protocol-relative.
- A partner can only mark their own receipt.
- The public shop and wholesale site do not show these notices.
