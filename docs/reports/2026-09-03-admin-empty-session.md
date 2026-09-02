# Admin empty / settings load error — 2026-09-03

## What the owner saw

- `/admin/settings` card: «تنظیمات بارگذاری نشد»
- Other admin pages looked empty (zeros, no products, no notifications)

## What is actually live

- API `/v1/health` 200
- Public catalog: 58 wholesale / 60 retail products
- `GET /v1/settings/public` 200
- `GET /v1/settings/admin` without JWT: 401 (expected)

Data was never missing. Admin APIs were rejecting the session.

## Root cause (why it repeats)

Staff may also shop. Shopper JWT is signed with `purpose=storefront` and the API
treats that user as CUSTOMER. Every admin endpoint then returns 403.

Three write/read bugs stacked:

1. **Write:** `setToken(token, role)` treated a staff *role* as an admin *session*.
   OTP / account login could put a storefront JWT into `taranom_admin_*` if the
   role string was ever ADMIN.
2. **Gate:** `/admin` middleware accepted `taranom_token` (shopper) when the
   admin cookie was missing, if a leftover `taranom_admin_role=ADMIN` existed.
3. **Read:** `getToken()` on `/admin` fell back to the shopper localStorage key.
   Dashboard / products swallowed the 403 and rendered empty data.

Same family as 2026-08-31 (cookie said ADMIN, JWT acted as CUSTOMER).

## Why it will not repeat

| Layer | Invariant |
| --- | --- |
| Write | Admin cookies are written only when `scope === 'admin'`. Role never decides. OTP/account pass `'storefront'`. |
| Cookie gate | Middleware requires `taranom_admin_token` whose JWT `purpose` is `admin`. |
| API send | `getToken()` on `/admin` returns null unless JWT purpose is `admin`. |
| Shell | `AdminSessionGate` redirects to `/admin/login` instead of showing zeros. |
| Pages | Settings / dashboard / products show the real 403 and link to login. |

Legacy admin JWTs without `purpose` are rejected (must re-login once).

## Owner after deploy

1. Open `/admin/login` — not storefront OTP, not portal
2. Sign in as staff
3. Settings, dashboard, and products load the same catalog the public sites already show
