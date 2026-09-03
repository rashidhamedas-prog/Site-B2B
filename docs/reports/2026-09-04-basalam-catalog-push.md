# ارسال کاتالوگ تکی به غرفه باسلام

تاریخ: 2026-09-04  
تسک: TASK-20260904-003  
شاخه: `ai/TASK-20260904-003-basalam-catalog`

## هدف

دکمه در `/admin/settings` (تب Google / پیکسل) که محصولات فعال فروشگاه تکی را با API رسمی باسلام به غرفه می‌فرستد.

## رفتار

- فقط محصول `ACTIVE` و قابل‌نمایش تکی (`isChannelVisible(..., 'RETAIL')`).
- موجودی از `channelAvailability(..., 'RETAIL')`؛ قیمت از `retailPrice` به تومان.
- اگر محصول در غرفه با SKU / کد مدل / عنوان هست، دوباره ساخته نمی‌شود؛ فقط نگاشت `basalamProductMap` ذخیره می‌شود.
- محصول جدید با `POST https://openapi.basalam.com/v1/vendors/{id}/products` ساخته می‌شود؛ عکس اول `POST /v1/files` با `file_type=product.photo`.
- وضعیت ساخت: unpublished (`3790`) تا عکس در پنل باسلام بررسی شود. `is_wholesale: false`.
- تکرار دکمه امن است: نگاشت بعد از هر محصول ذخیره می‌شود.
- کانکتور omnichannel روشن نشد.

## مسیرها

- `POST /v1/basalam/push-catalog?limit=8` — ADMIN + AdminOnly
- `POST /v1/basalam/sync-inventory` — به‌روزرسانی موجودی/قیمت محصولات نگاشت‌شده

## تست مشاهده‌شده

- `npx ts-node --transpile-only src/modules/basalam/basalam-catalog.spec.ts` → `basalam-catalog.spec.ts: ok`
- `npx ts-node --transpile-only src/modules/product/channel-stock-isolation.spec.ts` → `ok`
- `tsc --noEmit` در `apps/api` و `apps/web` → exit 0
- مرورگر ادمین روی لاگین زنده در این جلسه باز نشد؛ دکمه بعد از دیپلوی در `/admin/settings` تب مارکتینگ است.

## غیرهدف

- انتشار خودکار در ویترین عمومی باسلام
- ساخت محصول عمده
- روشن کردن `OMNICHANNEL_CONNECTORS_ENABLED`
