# PHASE 03A — CHANGES
Date: 2026-08-23
Task: TASK-20260823-002
Deploy: **NOT RUN**

## Applied (repo)

### 1. HTTP apex one-hop (nginx)

- Evidence: `http://poshaktaranom.ir/` → `https://poshaktaranom.ir/` → `https://www.poshaktaranom.ir/` (2 hops).
- File: `nginx/nginx.conf`
- Change: dedicated `listen 80; server_name poshaktaranom.ir;` returns `301 https://www.poshaktaranom.ir$request_uri` (hardcoded host). ACME location preserved.
- Other HTTP hosts unchanged (`https://$host$request_uri`).
- Rollback: restore the single combined port-80 `server` block.
- Production effect: **none until nginx is deployed**.

### 2. Sitemap cannot emit `/retail`

- Evidence: public sitemap had no `/retail` locs; `/retail` is 200+noindex. Defense in depth.
- File: `apps/web/src/lib/sitemap-xml.ts` `BLOCKED_PATH` includes `retail`.
- Rollback: remove `retail` from the regex.

### 3. Account login UI no longer points at `/retail/*`

- Evidence: `RetailOtpLogin` default redirect and two `<Link>`s used `/retail/checkout` and `/retail/products`. Public nav HTML does **not** contain `/retail` hrefs (live homepage check).
- File: `apps/web/src/components/retail/RetailOtpLogin.tsx`
- Change: `/checkout`, `/products`. API paths `/auth/retail/otp/*` unchanged.
- Rollback: restore `/retail/checkout` and `/retail/products` hrefs.

## Explicitly not changed

- `middleware.ts`: keep `/retail` 200 + noindex (Torob).
- `robots.ts`: no Disallow `/retail`; no broadening of Disallow.
- `next.config.ts`: claimed by TASK-20260823-001.
- `RetailHero.tsx` fallbacks still `/retail/products` and `/retail/collections` (claimed). Live CMS hrefs are public paths.
- No 404→home, no mass slug 301, no content rewrite, no GSC inspect ping.

## Security notes ([security-auditor](335a1a1e-ed01-4c6f-bdcb-4c60351abefb))

- One-hop apex uses hardcoded `www.poshaktaranom.ir`, not `$host`.
- Did not add Googlebot UA exceptions.
- Did not weaken robots.
- Open-redirect / draft-PDP findings logged as follow-on, out of PHASE-03A scope.
