# 2026-10-06 — Sales partner notices

## Outcome

Admins can publish one notice to every active sales partner from `/admin/sales-partners` → اطلاع‌رسانی. Partners see it at the top of `/sales-partners` until they dismiss it, and can reopen the list at `/sales-partners/notices`.

## Why this shape

Current in-app guidance keeps three surfaces apart: a toast for an action just taken, an inbox for messages a person may need later, and a banner for one message a whole audience must see. Cookie-only dismissal was rejected because a new login shows the message again. A hosted notification vendor was rejected because this audience already lives in the sales-partner tables.

## Validation

- `sales-partner-notice-policy.spec.ts` covers plain text, link safety, expiry, archive, and banner priority.
- Logged-in admin publish and partner dismiss were not clicked in a browser in this session.

## Not done

- SMS and email were left out on purpose.
- Shipped on `origin/master` so the live admin desk and partner panel pick it up. Migration `20261006-001-sales-partner-notices` runs with the API start.
