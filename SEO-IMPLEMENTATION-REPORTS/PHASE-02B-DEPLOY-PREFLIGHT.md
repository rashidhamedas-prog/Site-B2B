# PHASE-02B DEPLOY PREFLIGHT

Date: 2026-08-23  
Task: TASK-20260823-001  
Mode: production release gate for PHASE-01 + PHASE-02B only

---

## Git checkpoint (local, before isolated commit)

```text
branch: ai/TASK-20260822-004-retail-pdp
HEAD:   1f9d9bf Merge branch 'master' into ai/TASK-20260822-004-retail-pdp
origin/master: 6796362 Merge pull request #52 (retail PDP) — 1 commit ahead of local HEAD
```

Working tree is dirty with PHASE-01 + PHASE-02B storefront patches plus unrelated untracked backups/audit packages. Unrelated files will **not** be committed or deployed.

---

## Rollback target (current production)

```text
ROLLBACK_TARGET=6796362df51040ccfa591c02a1831320386b1cfa
ROLLBACK_DESC=Merge pull request #52 from rashidhamedas-prog/ai/TASK-20260822-004-retail-pdp
VPS: /opt/taranom, web image taranom-web, up 23 hours
```

---

## Files that will ship (PHASE-01 + PHASE-02B)

### PHASE-01 (GA4)

- `apps/web/src/lib/google.ts`
- `apps/web/src/lib/retail-analytics.ts` (new)
- `apps/web/src/lib/retail-analytics.spec.ts` (new)
- `apps/web/src/components/shared/GoogleTagManager.tsx`
- `apps/web/src/components/shared/DeferredGtm.tsx`
- `apps/web/src/components/shared/GoogleAnalytics.tsx`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/lib/retail-cart.ts`
- `apps/web/src/components/retail/RetailCartDrawer.tsx`
- `apps/web/src/components/retail/RetailPdpAnalytics.tsx` (new)
- `apps/web/src/app/retail/products/[slug]/page.tsx`
- `apps/web/src/components/retail/RetailProductsCatalog.tsx`
- `apps/web/src/app/retail/checkout/page.tsx`
- `apps/web/src/components/retail/RetailConversion.tsx`
- `SEO-IMPLEMENTATION-REPORTS/PHASE-01-*.md`

### PHASE-02B (performance / ISR / LCP / GTM loader)

- `apps/web/src/lib/cms/fetch.ts`
- `apps/web/src/lib/server-api-base.ts` (new)
- `apps/web/src/lib/server-api.ts`
- `apps/web/src/lib/google-seo.ts`
- `apps/web/src/app/layout.tsx` (shared with PHASE-01)
- `apps/web/src/app/retail/layout.tsx`
- `apps/web/src/app/retail/page.tsx`
- `apps/web/src/app/(wholesale)/layout.tsx`
- `apps/web/src/components/retail/RetailHero.tsx`
- `apps/web/src/components/shared/HeroCarousel.tsx`
- `apps/web/next.config.ts` (`images.minimumCacheTTL` only)
- `apps/web/src/app/retail/products/page.tsx`
- `apps/web/src/components/retail/RetailProductCard.tsx`
- `apps/web/src/components/shared/GoogleAnalyticsProvider.tsx`
- `apps/web/src/components/shared/WebVitalsReporter.tsx`
- `apps/web/src/components/blog/BlogAnalyticsTracker.tsx`
- `apps/web/src/components/blog/BlogCtaTags.tsx`
- `SEO-IMPLEMENTATION-REPORTS/PHASE-02B-*.md`

### Governance (append-only)

- `docs/WORKLOG.md`
- `.ai-dos/tasks/active.yaml`
- `.ai-dos/tasks/handoff.md`
- `.ai-dos/project/status.md`

## Explicitly NOT shipping

`.ai-dos/backups/`, `.cursor/rules/` copies, `.local-backup-*`, `.seo-baseline/`, `SEO-AUDIT-PACKAGE-POSHAKTARANOM-IR/`, `docs/00–11` scaffold, `prompts/`, `tasks/`, `validate_ai_dos.py`, `body.tmp`, `bot-body.tmp`.

No product/category/blog content, slugs, canonicals, sitemap, or middleware dual-host routing.

---

## Database / Prisma

This repo uses **TypeORM**, not Prisma. There is no `schema.prisma`.

PHASE-02B hard rule 3: **Do not run DB migrations. Expected: NONE.**

| Check | Result |
|-------|--------|
| `prisma migrate deploy` | **NOT RUN** — no Prisma schema; wrong stack |
| New TypeORM migration in ship set | **NONE** |
| Production schema mutation this release | **NONE** |

`scripts/auto-deploy.sh` still applies the existing idempotent `scripts/apply-production-schema.sql` safety-net (unchanged this release). That is not a new migration and is not Prisma.

---

## Internal API preflight (production web runtime)

Executed **inside `taranom_web`** with `API_INTERNAL_URL=http://api:4000/v1`. No secrets printed.

| Probe | HTTP | Bytes | Time | Payload |
|-------|-----:|------:|-----:|---------|
| `/health` | 200 | 55 | 224 ms | `status: ok` |
| `/settings/public?channel=RETAIL` | 200 | 6651 | 337 ms | retail business settings, non-empty |
| `/cms/site-content/RETAIL/home` | 200 | 1934 | 21 ms | RETAIL home, `type: hero` blocks present |
| `/products?channel=RETAIL&limit=8&status=ACTIVE` | 200 | 100895 | 101 ms | real products (e.g. `linen-sport-jacket-erika`) |

`NEXT_PUBLIC_API_URL` is set (host `poshaktaranom.com`, path `/api/v1`). Runtime SSR uses `API_INTERNAL_URL`. The same public base, probed from `taranom_web`, returned live CMS and products (health 200 / CMS 1934 B / products 49536 B). Production `docker compose build web` can therefore prerender against live catalog data.

**Internal API preflight: PASS**

Docker `web` build args also pass `NEXT_PUBLIC_API_URL`, so production `next build` on the VPS can reach the live public API for prerender (unlike a laptop build with no catalog). Runtime ISR then uses `http://api:4000/v1`.

---

## Local gates (this session)

| Check | Result |
|-------|--------|
| `apps/web` `npx tsc --noEmit` | **PASSED** (exit 0, ~41s) |
| `retail-analytics.spec.ts` | **PASSED** (`ts-node --transpile-only --skip-project` from `apps/api`, CJS compiler options) |
| `apps/web` `npx next build` | **PASSED** (Next 15.5.19, 73/73). `/retail` `○` static revalidate 1m. `/retail/products` `ƒ` dynamic (searchParams). `/retail/checkout`, `/retail/account`, `/retail/products/[slug]` `ƒ`. Local prerender still lacks catalog API; production docker build uses live `NEXT_PUBLIC_API_URL` + runtime `API_INTERNAL_URL`. |

---

## Unrelated dirty files

Present. Isolated commit will add only the ship list above. If isolation fails, **STOP** (PHASE-02B rule).
