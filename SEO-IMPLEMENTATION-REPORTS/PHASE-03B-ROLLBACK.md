# PHASE 03B — ROLLBACK
Deploy was **not run**. Production still serves current live middleware 410s without the new 301 exceptions.

## If this branch is deployed later and must be undone

1. Revert `apps/web/src/middleware.ts` GSC lookup (restore `/product/161/...` to 410 and `/category/20` to the missing-category path).
2. Delete `apps/web/src/lib/gsc-legacy-redirects.ts` and `.spec.ts`.
3. Revert `RetailFooter.tsx` keys if the discovery-source fix must also be undone (safe to leave).
4. Rebuild/redeploy web as in the normal release rollback (PHASE-02B live SHA `13bf657` at start of 03A/03B).

## Data

No DB migration. No sitemap edits.

## GSC

No indexing requests were sent. No Search Console setting was changed from this repo.
