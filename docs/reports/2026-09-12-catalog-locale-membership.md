# 2026-09-12 — رقم فارسی، هویت دسته، عضویت چنددسته

## چه عوض شد

- آمار ویترین رقم را موقع نمایش با `shapeDigitsInText` فارسی می‌کند؛ ادمین همان عدد لاتین را ذخیره می‌کند.
- دسته با نام فارسی (حتی با فاصله) ساخته می‌شود؛ slug از `nameEn` یا نویسه‌گردانی `name` می‌آید.
- میانبر و گرید خانه از دسته‌های ACTIVE می‌آیند؛ `categoryIds` در CMS فقط پین می‌کند و بقیه را پنهان نمی‌کند.
- محصول یک دستهٔ اصلی دارد و می‌تواند در چند دستهٔ اضافی هم باشد (`product_category_membership`). ستون `products.categoryId` حذف نشد.

## امنیت / مهاجرت

- جدول جدید additive است؛ FK محصول CASCADE، دسته RESTRICT.
- حذف دسته اگر هنوز محصول یا عضویت داشته باشد رد می‌شود.
- `categoryIds` در DTO با UUID اعتبارسنجی می‌شود؛ لیست عمومی با پارامتر bind شده فیلتر می‌شود.
- Reviewer/Security مستقل روی این مهاجرت هنوز اجرا نشده؛ rollback = `down()` جدول.

## شواهد گیت

- Commit runtime: `4b78bcf` on `origin/master`.
- Migration `ProductCategoryMembership1757670000002` applied; `product_category_membership` count 60.
- API health 200. `.com/contact` 0 campaign plates / home 2; `.ir/contact` 0 DigiPay / home 2.
