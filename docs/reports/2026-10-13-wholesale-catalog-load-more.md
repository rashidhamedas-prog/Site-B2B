# Wholesale catalog: only 24 of 91 models visible

**Date:** 2026-10-13  
**Surface:** `poshaktaranom.com/products`

## Problem

Counter showed `meta.total` (~91) while the grid only rendered the first API page (`limit=24`). No pagination or load-more UI existed on wholesale `ProductCatalog` (retail already had both).

## Root cause

`ProductCatalog` always requested `limit=24` without `page`, replaced the list on every fetch, and never exposed `totalPages`. API pagination already worked (`totalPages=4` live).

## Fix

- Pass `page` + `limit=24` in the wholesale catalog query.
- Seed `initialTotalPages` from SSR (`products/page.tsx` → `WholesaleProductsCatalogWithUrl`).
- Add «بارگذاری بیشتر» that appends the next page (keeps first-page LCP budget).
- Show «X نمایش‌داده‌شده» when more pages remain.

## Perf

Initial paint stays 24 cards; deeper pages load on demand only. No raise of SSR `limit`.

## Verify

- Live API before fix: `GET /api/v1/products?channel=WHOLESALE&limit=24&page=1` → `total=91`, `totalPages=4`; page 2 returns next 24.
- After deploy: `/products` shows load-more; clicking through reaches all models.
