# 2026-09-12 — ریل فیلتر کاتالوگ عمده و تکی

## هدف

جایگزین کردن فیلتر متنی/select صفحه `/products` با یک ریل گرافیکی مشترک برای عمده و تک، بدون تغییر API.

## تصمیم‌ها

- دسکتاپ: ریل چسبان سمت راست (RTL)، اعمال فوری.
- موبایل: کشو + دکمه «نمایش نتایج» روی پیش‌نویس.
- رنگ با سواچ، پارچه با بافت CSS، سایز با کارت. شمارش هر گزینه ساخته نشد چون API bucket ندارد.
- `inStock=1` از همان query موجود.

## فایل‌ها

- `apps/web/src/lib/catalog-filter.ts` + spec
- `apps/web/src/components/catalog/CatalogFilterRail.tsx`
- `apps/web/src/components/catalog/CatalogFilters.tsx`
- `ProductCatalog.tsx` / `RetailProductsCatalog.tsx` + WithUrl
- `apps/web/src/app/globals.css`
- `docs/architecture/catalog-filter-rail.md`

## اعتبارسنجی

- `node --experimental-strip-types src/lib/catalog-filter.spec.mts` → ok
- `apps/web` `npx tsc --noEmit` → 0
- Live VPS `f6d1a5a`: `.com/products` و `.ir/products` 200؛ ریل راست با سواچ/چیپ/سوئیچ.
- Browser: لینن روی عمده → چیپ + ۲۲ مدل؛ تکی همان شِل کرم/طلایی + قیمت/یقه.
- پارچه‌های فرعی در آکاردئون «سایر پارچه‌ها».
