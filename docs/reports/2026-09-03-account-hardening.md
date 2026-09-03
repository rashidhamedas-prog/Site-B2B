# Account leftovers — JWT revoke, portal redirect, Persian OTP

Task: TASK-20260903-006  
Date: 2026-09-03

## What changed

- `users.passwordChangedAt` (nullable timestamptz). After change / set / public reset / admin staff reset, JWTs with an earlier `iat` fail `JwtStrategy.validate`.
- change / set / reset issue a fresh token for the current purpose so the tab that just changed the password stays signed in. OTP session is cleared after set.
- `useAuth` post-login `redirect` is prefix-allowlisted (`/portal` or `/admin`). Absolute, protocol-relative, `/admin` on portal, and login loops fall back.
- Retail OTP request/verify and reset code accept Persian / Arabic-Indic digits via `Transform`.
- Wholesale register placeholder matches the 8-character policy.
- Pending wholesale reset stays on the form and shows «پس از تأیید حساب وارد شوید» instead of navigating away.

## Non-goals

- Retail middleware account gates (`middleware.ts` still TASK-20260903-001).
- Invoice IDOR.
- JWT denylist of individual `jti`s.

## Rollback

Revert this branch. Migration down drops `passwordChangedAt`. Existing tokens without a stamp stay valid.
