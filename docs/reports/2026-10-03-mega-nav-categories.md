# Mega-nav categories stuck loading (2026-10-03)

## Symptom

Retail header «دسته‌بندی» showed «در حال بارگذاری…» with no category links, while homepage category pills (SSR) already listed فوتر/کراپ/….

## Root cause

1. Mega menu treated `categories.length === 0` as infinite loading — no separate ready/error state.
2. Categories were loaded only via client `apiClient` after hydration; first open often painted empty.
3. Static «همه کالکشن‌ها» made the panel look half-alive even when fetch had not finished.

Live `/api/v1/categories` returns 200 + ~17 ACTIVE rows (~160ms); API itself was healthy.

## Fix

- SSR-seed `navCategories` / `navCollections` in `retail/layout.tsx` → `RetailChromeBag`.
- `RetailHeader` initializes from seed (instant mega).
- Soft client refresh; skeleton only when seed empty; error + retry otherwise.
- Category links prefer `/category/{slug}` like home pills.

## Perf

- One parallel SSR fetch with existing chrome/settings (revalidate 60s via `catalogFetchInit`).
- No new client libraries; skeleton is CSS `animate-pulse` + `motion-reduce`.
