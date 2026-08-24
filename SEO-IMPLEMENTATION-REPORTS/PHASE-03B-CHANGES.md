# PHASE 03B — CHANGES
Date: 2026-08-24
Task: TASK-20260824-001
Deploy: **NOT RUN**

## Applied (repo)

### 1. Footer discovery source

- Evidence: five GSC 404 paths equal `href + label` in `RetailFooter` `COLS`, while live `Link href={l.href}` is correct.
- File: `apps/web/src/components/retail/RetailFooter.tsx`
- Change: list keys `key={`${col.title}-${i}`}` instead of `l.href + l.label`.
- Rollback: restore `key={l.href + l.label}`.
- Production effect: none until web deploy.

### 2. Proven legacy 301s

- File: `apps/web/src/lib/gsc-legacy-redirects.ts` (new) wired in `apps/web/src/middleware.ts` **before** `/product/` 410.
- Mappings:
  - `/category/20` and `/category/20/شلوار` → `/category/women-pants` (search stripped)
  - `/product/161/شلوار-ماهین` → `/products/maserati-pants-mahin` (search stripped)
- Spec: `apps/web/src/lib/gsc-legacy-redirects.spec.ts`
- Rollback: remove the lookup call and the new module.
- Production effect: none until web deploy (live still 410 for ماهین and 404 for category 20/شلوار).

## Explicitly not changed

- No mass 404→301.
- `/account` robots + noindex kept.
- `/uploads/` stays gone (410); listing not enabled.
- Fonts, manifest, `/_next/image` not added to sitemap and not wrapped as HTML.
- API URLs not redirected to content pages.
- `/blog/feed/` and `/blog/31-معرفی/feed/` stay 410 (already live).
- `next.config.ts` / `RetailHero.tsx` (TASK-20260823-001).
- `nginx/nginx.conf` (TASK-20260823-002).
- No guessed `/category/17` or `/category/10` or ترگل/ساغر/سهند mappings.

## Security notes

- 301 destinations are hardcoded public paths (`/category/women-pants`, `/products/maserati-pants-mahin`).
- Query strings on those sources are dropped (no open redirect).
- No Googlebot UA exception. No robots weakening.
