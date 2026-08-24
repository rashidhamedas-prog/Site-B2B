# PHASE 03A — TEST RESULTS
Date: 2026-08-23
SHA local: uncommitted TASK-20260823-002 worktree
Production still: `13bf657` (PHASE-02B). This phase **not deployed**.

## Commands

| Command | Cwd | Exit |
|---|---|---:|
| `npx tsc --noEmit` | `apps/web` | **0** |
| `npm run build` | `apps/web` | **0** (Next 15.5.19, 73/73) |
| `npm run seo:check` | repo root | **0** (`.com` 83/83, `.ir` 77/77) |

Relevant unit tests: none added (no generator unit spec in tree). `seo:check` is the sitemap contract test.

## Live smoke (production HTML, 2026-08-23)

| URL | HTTP | Canonical | robots | `/retail` in canonical | notes |
|---|---:|---|---|---|---|
| `/` | 200 | `https://www.poshaktaranom.ir` | index,follow | no | ISR |
| `/products` | 200 | `/products` | index,follow | no | |
| `/category/shomiz` | 200 | self | index,follow | no | |
| `/products/linen-sport-jacket-erika` | 200 | self | index,follow | no | |
| `/blog/trendy-womens-shirt-1405` | 200 | self | index,follow | no | |
| `/sitemap.xml` | 200 | n/a | n/a | n/a | 4 children |
| `/robots.txt` | 200 | n/a | n/a | n/a | sitemap www |
| `/this-page-does-not-exist-p03a` | **404** | n/a | n/a | n/a | hard 404 |
| `/search` | 301 → `/products` | | | | expected |
| `/shop` | 301 → `/products` | | | | expected |
| `/retail` | 200 | public home | X-Robots-Tag noindex | no | keep; no 301 |
| `/products?page=2` | 200 | `/products` | noindex,follow | no | expected |
| `/account` | 200 | | noindex,nofollow | | private |
| `/checkout` | 200 | | noindex (layout) | | private; robots.txt Disallow |

Host: `http://poshaktaranom.ir/` still **2 hops** on production (nginx change not deployed).

## SEO regression

**PASSED** — live sitemap URLs 200, not redirect, not noindex, self-canonical, www HTTPS. No `/retail` leak in public canonicals.

## Deploy

**NOT RUN**
