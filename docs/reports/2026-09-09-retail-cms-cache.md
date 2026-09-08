# Retail CMS cache root fix (2026-09-09)

## Problem

Wholesale CMS saves appeared on `.com`. Retail saves did not appear on `.ir` (or only after a long wait / hard fight with cache).

## Root causes

1. **Path shape mismatch.** Retail public URLs (`/`) are middleware-rewritten to App Router `/retail`. Revalidating only one shape left the other sticky.
2. **Year-long SWR.** Next ISR emitted `Cache-Control: s-maxage=60, stale-while-revalidate=31535940`, so edge/`x-nextjs-cache: HIT` could keep serving stale HTML.
3. **Silent revalidate failures.** Admin treated save as fully done even if bust failed.
4. **Channel isolation.** RETAIL and WHOLESALE CMS rows are separate; editing wholesale does not change `.ir` (UX reminder added).

## Fix

| Layer | Change |
|---|---|
| Paths | `allRevalidatePathsForCms` = App + public aliases for retail |
| Warm | After `revalidatePath`/`revalidateTag`, internal fetch of `/retail` (or wholesale `/`) |
| Headers | Middleware clamps public storefront HTML to `s-maxage=60, stale-while-revalidate=60` (skips admin/portal/checkout/account/payment) |
| Admin | Alert if revalidate fails after successful CMS put; channel reminder for تکی vs عمده |

## Perf note

Shorter SWR means edge may refetch home HTML more often after the 60s window — intentional trade-off so CMS edits are not stuck for up to a year. Home product budget remains ≤12; no extra LCP `priority` on cards.

## Verify after deploy

1. `Cache-Control` on `https://taranommall.ir/` includes `stale-while-revalidate=60` (not ~31535940).
2. Save RETAIL home in `/admin/site-content` (تب تکی) → home HTML updates without waiting for year SWR.
3. Unauth `POST /admin/cms/revalidate` still redirects to login (307).
