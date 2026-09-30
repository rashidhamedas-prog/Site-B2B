# گزارش: برچسب کارت عمده روی `/products` اعمال نمی‌شد

تاریخ: 2026-10-01  
تسک: TASK-20261001-001

## علائم

در ادمین فیلد «برچسب کارت عمده (متن کامل)» پر و ذخیره می‌شد، ولی کارت‌های کاتالوگ عمده همچنان پیش‌فرض «حداقل N پک» را نشان می‌دادند.

## شواهد قبل از فیکس

- `GET /v1/products?channel=WHOLESALE` برای `COATS00013` (کت ژاکارد مدل پردیس): `orderBadgeLabel = "حداقل سفارش 6 عدد"`.
- DOM کارت همان SKU روی `poshaktaranom.com/products`: متن چیپ = «حداقل ۱ پک» (fallback).

پس persistence سالم بود؛ مسیر نمایش کاتالوگ شکسته بود.

## ریشه

زنجیرهٔ درست:

1. SSR: `slimWholesaleCatalogProduct` فیلد `orderBadgeLabel` را نگه می‌دارد.
2. Client hydrate: `ProductCatalog.normalizeCatalogProduct` فقط زیرمجموعه‌ای از فیلدها را کپی می‌کرد و **`orderBadgeLabel` را حذف می‌کرد**.
3. `skipNextFetch` اولین refetch کلاینت را رد می‌کند تا HTML SSR حفظ شود → صفحهٔ تمیز `/products` با دادهٔ بدون badge می‌ماند.

## اصلاح معماری

- استخراج `normalize-catalog-product.ts` به‌عنوان قرارداد نرمال‌سازی کارت عمده (SSR seed + refetch).
- حفظ اجباری: `orderBadgeLabel`, `minOrderQty`, `allowWholesaleColorSelect`, `minWholesaleColors`.
- ادمین: پیش‌نمایش زندهٔ `resolveWholesaleOrderBadge` تا «اعمال» قبل از ذخیره دیده شود؛ جدا کردن «محاسبه پک برای سبد» از برچسب کارت.

## اعتبارسنجی

- `npx tsx src/components/wholesale/normalize-catalog-product.spec.ts` → ok
- `npx tsx src/lib/wholesale-order-badge.spec.ts` → ok
- `npx tsx src/lib/slim-wholesale-catalog.spec.ts` → ok
- `npx tsc --noEmit` در `apps/web` → exit 0 (پیش از commit)

پس از deploy: کارت `COATS00013` باید «حداقل سفارش 6 عدد» نشان دهد.
