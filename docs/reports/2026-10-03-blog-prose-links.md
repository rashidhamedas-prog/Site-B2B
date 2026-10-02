# Blog prose inline links — high affordance

**Task:** TASK-20261003-002  
**Date:** 2026-10-03  
**Depth:** skill-top full

## Problem

Inline links inside blog articles were nearly invisible:

- Global `a { text-decoration: none }` and `.retail-root a { text-decoration: none }` removed underlines.
- `BlogContent` only tinted links (`amber-800` / `primary`) with no hover/focus affordance beyond color.

## Research (folded into design)

- WCAG: underline is the preferred non-color cue for inline links; color alone is insufficient.
- Pattern reused (conceptually): editorial prose links with underline thickness + marker highlight + `box-decoration-break: clone` for multi-line fragments.
- Reference practices: Filament Group accessible links; modern prose underline thickness / offset; Chrome `box-decoration-break: clone` for padded inline marks.

## Solution

CSS-only on `.blog-prose a`:

1. Brand green link color + medium-bold weight
2. Always-on underline (`max(2px, 0.12em)` thickness, offset)
3. Soft gold marker band behind the text (brand secondary)
4. Larger tap padding + `box-decoration-break: clone`
5. Stronger hover mark/underline; clear `:focus-visible` ring
6. Retail override so `.retail-root a` cannot strip blog underlines

Tone classes: `blog-prose--retail` / `blog-prose--wholesale`.

## Non-goals

- Admin TipTap chrome
- Category/PDP `retail-prose` (out of blog scope)
- New JS or third-party deps

## Files

- `apps/web/src/components/blog/BlogContent.tsx`
- `apps/web/src/app/globals.css`
- `apps/web/src/app/retail/retail.css`

## Perf

No new JS, images, or waterfall. CSS-only; negligible payload.
