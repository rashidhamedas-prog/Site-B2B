# گزارش — CTA قابل‌مدیریت دسته‌بندی (عمده / تک)

تاریخ: 2026-10-19  
تسک: TASK-20261019-002

## خلاصه

سیستم CTA per-channel برای صفحات `/category/{slug}` اضافه شد. تنظیمات از `/admin/categories` قابل مدیریت است و پیش‌فرض همه دسته‌ها غیرفعال است (`NULL`).

## ذخیره

- ستون jsonb `cta` (تکی)
- ستون jsonb `wholesaleCta` (عمده)
- Migration: `apps/api/src/database/migrations/20261019-002-category-cta.ts`

## فیلدها

`enabled`, `label`, `destination` (`listing`|`custom`), `customUrl`, `placement` (`below_intro`|`below_bottom`), `variant` (`primary`|`secondary`)

مقصد listing → `#category-listing` (شناسه‌های موجود حفظ شدند؛ `scroll-mt-32` اضافه شد).

## وضعیت انتشار

- Commit: `61233b3e` روی `ai/TASK-20261019-002-category-cta` و `origin/master`
- VPS deploy: کامل در `61233b3`؛ API health `ok`
- Migration Production: با `migrationsRun` روی استارت API اعمال شد؛ ستون‌های `cta` و `wholesaleCta` در `categories` موجودند
- Migration روی DB محلی لپ‌تاپ: ناموفق بود (`ECONNREFUSED`) — بی‌اهمیت پس از apply پروداکشن

## تست

- `category-cta.spec` (api + web) OK
- migration source spec OK
- `apps/web` tsc OK
- Storefront smoke: `https://poshaktaranom.com/category/bamber` → HTTP 200
- هیچ CTA به‌صورت خودکار فعال نشد (پیش‌فرض NULL)
