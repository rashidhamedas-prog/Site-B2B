# 2026-09-13 — Sender postal in business settings

Admin «کسب‌وکار» now has «کدپستی دفتر پخش» (`business.postalCode`). Stored as ASCII digits (max 10). Mobiles starting with `09` are rejected. Public `GET /settings/public` exposes it. A5 packing slip uses this field first.

No migration — JSON `app_settings` key `business`.

Live `776108a`: `GET /v1/settings/public` includes `business.postalCode` (currently empty).
