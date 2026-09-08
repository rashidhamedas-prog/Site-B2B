# ADR: Channel-scoped system settings IA

Date: 2026-09-08  
Status: Accepted  
Task: TASK-20260908-004

## Context

Retail (`.ir`) and wholesale (`.com`) share one admin settings page. Shipping companies, Peystaz quote, SMS ops, and the home ticker were either shared or parked above the tabbed settings as separate save bars. Operators could change one channel and affect the other.

## Decision

Keep a modular monolith settings group model (`PUT /settings/admin/:group`). Scope storefront-affecting values by channel inside existing groups:

- `shipping.retail` / `shipping.wholesale` own fees, help text, and companies.
- `shippingPost.retail` / `shippingPost.wholesale` own Peystaz quote. Legacy flat JSON hydrates both until the next save.
- `smsOps.retail` / `smsOps.wholesale` stay as they were, but live in the SMS tab.
- Home ticker remains CMS `chrome.announcement` per channel, edited from the theme tab.

Public `GET /shipping/methods?channel=` and `GET /settings/public?channel=` return only that channel’s active companies. Missing channel on methods/public defaults to WHOLESALE so existing wholesale checkout stays compatible.

## Consequences

- One save button per settings tab; shipping save writes `shipping` + `shippingPost`.
- Retail checkout reads methods from the API with a hardcoded fallback.
- No new secrets, no payment adapter change, no migration.
