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

- Commit محلی: بله (طبق درخواست مالک)
- Push / Deploy Production: خیر (منتظر تأیید)
- Migration روی DB محلی این ماشین: ناموفق — Postgres روی `localhost:5432` در دسترس نبود (`ECONNREFUSED`)
- Migration Production: اجرا نشده

## تست

- `category-cta.spec` (api + web) OK
- migration source spec OK
- `apps/web` tsc OK
