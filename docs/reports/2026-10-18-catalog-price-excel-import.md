# آپدیت قیمت محصولات از اکسل (فقط قیمت)

تاریخ: 2026-10-18  
تسک: TASK-20261018-003  
عمق: skill-top full

## خلاصه

کنار خروجی اکسل کاتالوگ، مسیر جدا برای **به‌روزرسانی قیمت عمده و تکی** اضافه شد: قالب راهنما، پیش‌نمایش (dry-run)، سپس اعمال. سلول خالی = بدون تغییر. موجودی/نام/دسته/سئو دست نمی‌خورد.

## API (ادمین JWT)

| متد | مسیر | نقش |
| --- | --- | --- |
| GET | `/v1/products/admin/price-template.xlsx` | قالب با شیت «قیمت‌ها» + «راهنما» |
| POST | `/v1/products/admin/prices/import.xlsx?dryRun=1\|0` | multipart فایل `.xlsx` |

## قوانین

- کلید تطبیق: `SKU` (alias هم پشتیبانی می‌شود)
- شناسه اختیاری؛ اگر پر شود باید با همان محصول باشد
- واحد: تومان → ذخیره ریال (`×۱۰`)
- سقف: ۵۰۰۰ ردیف، ۸MB
- ردیف نامعتبر رد می‌شود؛ بقیه در همان درخواست قابل اعمال‌اند
- بدون وابستگی npm جدید؛ خواندن OOXML با `xlsx-reader` و نوشتن با `xlsx-builder`

## UI

ادمین → محصولات: بلوک «آپدیت قیمت اکسل» کنار خروجی اکسل.

## تست

```bash
cd apps/api
npx ts-node --transpile-only src/common/xlsx-reader.spec.ts
npx ts-node --transpile-only src/modules/product/catalog-price-import.spec.ts
npx ts-node --transpile-only src/modules/product/product-pricing.invariant.spec.ts
```

## 21st.dev

جستجو برای dropzone انجام شد؛ به‌خاطر حفظ تراکم UI ادمین و سهمیهٔ رایگان، از input فایل بومی هم‌سبک دکمه‌های موجود استفاده شد (AI generation خاموش بود).

## تحقیق (folded)

- الگوی preview → validate → commit (AppMaster / Presta mass updater)
- blank cell = no overwrite (Elovate)
- match by stable SKU only
- بدون افزودن `@nestbolt/excel` — استک فعلی writer حفظ شد
