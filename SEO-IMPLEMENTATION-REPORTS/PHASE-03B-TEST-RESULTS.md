# PHASE 03B — TEST RESULTS
Date: 2026-08-24
SHA local: uncommitted TASK-20260824-001 worktree
Production still: PHASE-02B `13bf657` + already-live `/product/` and `/uploads/` 410s. This phase **not deployed**.

## Commands

| Command | Cwd | Exit |
|---|---|---:|
| `npx tsc --noEmit` | `apps/web` | **0** |
| `npm run build` | `apps/web` | **0** (Next 15.5.19, 73/73; middleware 35.2 kB) |
| `node --experimental-strip-types src/lib/gsc-legacy-redirects.spec.ts` | `apps/web` | **0** (`ok`) |
| `npm run seo:check` | repo root | **0** (`.com` 83/83, `.ir` 77/77) |

## Live smoke (production HTML, 2026-08-24)

| URL | HTTP | notes |
|---|---:|---|
| `/` | 200 | |
| `/products` | 200 | |
| `/category/shomiz` | 200 | |
| `/products/linen-shirt-manteau-golrokh` | 200 | active PDP |
| `/blog` | 200 | |
| `/sitemap.xml` | 200 | 77 locs |
| `/robots.txt` | 200 | Disallow `/account` |
| `/account` | 200 | meta noindex,nofollow |
| `/uploads/` | 308 → `/uploads` **410** noindex | expected gone directory |
| `/category/women-pants` | 200 | 301 target (self-canonical) |
| `/products/maserati-pants-mahin` | 200 | 301 target (self-canonical) |

New 301 sources (`/category/20`, `/category/20/شلوار`, `/product/161/شلوار-ماهین`) are **not live yet**. Spec `gsc-legacy-redirects.spec.ts` covers one-hop mapping + encoded/trailing-slash variants. No loop in map (targets are current 200 canonicals, not in the source map).

## SEO regression

**PASSED** — live sitemap URLs 200. No `/retail` leak in this check. GSC problem URLs remain out of sitemap.

## Deploy

**NOT RUN**
