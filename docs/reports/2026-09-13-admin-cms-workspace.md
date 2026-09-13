# TASK-20260913-014 — Admin site-content workspace

Date: 2026-09-13  
Branch: `ai/TASK-20260913-014-admin-cms-workspace`

## Outcome

`/admin/site-content` is one workspace (`?channel=&page=`). Every pageKey has defaults, a live route, per-page SEO, and dedicated image alt on CMS media. Product gallery alts stay on `/admin/products` (`imageAlts`, already live).

## Evidence used

- Repo: `site_contents.seo` existed but admin never saved it; retail `/privacy` and `/terms` were revalidated and sitemapped but had no App Router pages.
- Slack public search: no project messages for CMS / image alt.
- GitHub MCP: unavailable this session.
- Public patterns applied without installing them: Payload blocks+SEO plugin, Payload upload alt fallback (instance → caption → empty), Ghost URL workspace, Saleor/Medusa per-image alt.

## What changed

- Workspace URL is source of truth; dirty confirm on channel/page switch.
- Save writes `title`, `blocks`, `seo`, `isPublished`; refetch + storefront revalidate unchanged.
- SEO allowlist sanitized on API write and public read.
- `image` / `gallery` have `imageAlt`; renderer no longer uses caption-only or filename.
- Chrome can copy phone/address/social from settings business (CMS does not write settings).
- Retail privacy/terms pages exist; retail sitemap includes them.
- Catalog/about pages consume CMS intro + metadata.

## Gates run

- `admin-cms-workspace.spec.ts`: ok
- `page-seo.spec.ts`: ok
- `cms-page-seo.spec.ts`: ok
- `cms-sanitize.spec.ts`: ok
- `revalidate-storefront.spec.ts`: ok
- `apps/web` `tsc --noEmit`: 0
- `apps/api` `tsc --noEmit`: 0
- Admin click/save: live persist via production `site_contents` (admin HTTP login password in WORKLOG is stale)
- VPS HEAD `b628674`; health 200; `.ir`/`.com` homes 200
- Live titles: `.ir` «خرید تکی پوشاک زنانه مشهد | پوشاک ترنم»; `.com` «تولیدی مانتو مشهد | خرید عمده | پوشاک ترنم»; `/privacy` on both hosts uses stored SEO

## Residual

- Hero/home/chrome block bodies were not replaced; only empty SEO and missing imageAlt were filled.
- Wholesale about body stays the designed view; CMS intro only if a stored row has extra blocks.
- Independent Reviewer/Security still required for CMS HTML sanitize (pre-existing).
