# نشست جدا برای پنل تکی و عمده

Task: TASK-20260904-001  
Date: 2026-09-04

## Brief

Owner confirmed: one phone may be both retail and wholesale; login stays phone (no username); wallet stays on both panels; wholesale returns/notifications stay out of the menu until those APIs exist.

This slice is phase 0+1 of the dual-panel architecture: production host lock, JWT `purpose` split, separate cookies, D1 retail OTP for pending wholesale, and hide the empty notifications nav item.

## Root cause (debug)

`JwtStrategy.validate` mapped every non-admin token through `resolveAuthPurpose('portal')`, so a retail OTP session could never stay `retail`. Combined with `/portal` being channel-exempt, `.ir` served the wholesale chrome.

## What changed

- JWT purpose is `admin | retail | wholesale`. Legacy `storefront` validates as wholesale.
- Retail OTP/password issues `purpose=retail`. Portal login issues `purpose=wholesale`.
- Pending B2B can complete retail OTP without flipping `customers.status` to ACTIVE.
- B2C password cannot open the wholesale portal.
- Production `.ir /portal*` → `https://poshaktaranom.com/...`; `.com /account*` → `https://www.poshaktaranom.ir/account...`. Localhost unchanged.
- Cookies: `taranom_retail_token` / `taranom_wholesale_token` (legacy `taranom_token` still read).
- Wholesale sidebar/header no longer list notifications.
- `/dashboard/mine` requires a wholesale-purpose JWT.

## Non-goals this slice

- Membership table / two Customer rows per phone (still one `customers.phone`).
- Server-enforced order `type` from JWT (`order.controller` remains TASK-20260826-001).
- Wholesale RMA or in-panel notification feed.

## Tests observed

- `apps/api` `staff-access.spec.ts`, `shopper-channel.spec.ts`, `password-policy.spec.ts` OK
- `apps/web` `panel-host-lock.spec.ts`, `admin-session.spec.ts` OK
- `apps/api` and `apps/web` `tsc --noEmit` 0

## Rollback

Revert this branch. No migration. Old JWTs with `purpose=storefront` still authenticate as wholesale shoppers until expiry (7 days).
