# PHASE 03B — SUMMARY
Date: 2026-08-24
Task: TASK-20260824-001
Production at probe: `https://www.poshaktaranom.ir` (PHASE-02B `13bf657` plus already-live middleware 410s). Repo 03B patches **not deployed**.

GSC exact URLs analyzed:
45 fully specified + 1 incomplete export row (`encoded /tag/...`) not invented

404 samples analyzed:
31

Crawled-not-indexed samples analyzed:
12

Intentional resource/private exclusions:
13 (2 fonts, 6 `/_next/image` product media, 1 manifest, 2 `/api/` JSON, `/account`, `/uploads/`, plus empty Discovered table)

Malformed URLs still generated internally:
0 hrefs in live HTML. 5 React `key={href+label}` concatenations were in source (not hrefs); fixed this session.

Malformed URL generators fixed:
1 (`RetailFooter` list keys)

Exact legacy product redirects added:
1 (`/product/161/شلوار-ماهین` → `/products/maserati-pants-mahin`)

Exact legacy category redirects added:
1 mapping, 2 source paths (`/category/20` and `/category/20/شلوار` → `/category/women-pants`)

Legitimate 404/410 retained:
26 of the 31 GSC 404 sample rows (4 redirected, 1 incomplete export)

Account robots status:
EXPECTED

/uploads 403 status:
EXPECTED (GSC 403 is stale; live is 410 Gone + noindex. Directory listing remains off.)

Duplicate feed issue:
RESOLVED (live 410 Gone; not equivalent to `/blog/feed.xml` category feed)

Current internal references to GSC-problem URLs:
0 accidental hrefs. Intentional resource refs remain: `layout.tsx` fonts + manifest; product cards still use shared `poshaktaranom.com/media` via `/_next/image` (architecture: `next.config.ts` remotePatterns).

Safe fixes applied:
3 (footer key discovery source; 1 product 301; 1 category 301)

GSC_SAMPLE_COUNT_DIFFERENCE:
Previous brief 33 404 / 13 crawled-not-indexed. This export 31 / 12. Missing rows were not invented.

Discovered - currently not indexed:
CURRENTLY_RESOLVED / NO_ACTION (empty table)

Deployment:
NOT RUN
