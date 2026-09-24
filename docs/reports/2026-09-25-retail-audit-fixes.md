# Retail audit root fixes — 2026-09-25

## Scope

Live audit of `www.poshaktaranom.ir` found soft-404s, public `/retail/*`, empty collections, PDP copy/price/OG issues, missing CMS H1s, and checkout cart flash.

## Root causes and fixes

| Issue | Root cause | Fix |
|-------|------------|-----|
| Soft 404 (HTTP 200) | `app/retail/loading.tsx` streamed shell before `notFound()` | Deleted loading shell; `notFound()` in category/blog metadata |
| `/retail` duplicate | Middleware rewrite exposed internal tree; 301 was avoided for Torob rewrite-header loops | Host `beforeFiles` rewrites in `next.config`; direct `/retail` → 301; robots Disallow |
| Empty collections | Collection table empty but nav promised content | Fallback grid from `/categories` |
| «سایز سایز ۱» | Label already contained سایز; `\b` fails for Persian | `formatSizePhrase` / `stockRemainingCopy` |
| ۱٬۴۰۹٬۹۹۹ تومان | IRR `14099990` off-by-10 from admin entry | `toman()` snaps within 1 toman of round هزار |
| OG on `.com` | PDP `absUrl` kept absolute `.com` media hosts | `absoluteJsonLdUrl('RETAIL', …)` rebases |
| CMS no H1 | Blocks lacked heading | `CmsPage` title prop |
| Checkout empty flash | Zustand persist hydrate after first paint | Wait for `onFinishHydration` |

## Validation (pre-deploy)

- `npx tsc --noEmit` in `apps/web`: pass
- Inline asserts for toman snap + size phrase: pass
- Live verification required after VPS deploy

## Rollback

Revert this commit; restore `retail/loading.tsx` only if soft-404 trade-off must return.
