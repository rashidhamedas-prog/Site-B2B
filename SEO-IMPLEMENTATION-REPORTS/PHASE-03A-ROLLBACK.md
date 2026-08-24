# PHASE 03A — ROLLBACK
Deploy was **not run**. Live nginx/app still pre-change until a future release.

## If this branch is deployed later and must be undone

1. Revert `nginx/nginx.conf` port-80 split (restore one `server_name` list including `poshaktaranom.ir` with `return 301 https://$host$request_uri`).
2. Revert `BLOCKED_PATH` in `apps/web/src/lib/sitemap-xml.ts` (drop `retail`).
3. Revert `apps/web/src/components/retail/RetailOtpLogin.tsx` hrefs/default redirect.
4. Reload nginx / rebuild web as in the normal release rollback (`13bf657` is the PHASE-02B production SHA at start of this phase).

## Data

No DB migration. No sitemap URL deletions of active products.

## GSC

No indexing requests were sent. No Search Console setting was changed from this repo.
