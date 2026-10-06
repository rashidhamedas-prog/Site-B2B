# ثبت محصول: اسلاگ تکراری، بعد ۵۰۰

## ریشه

لاگ `taranom_api` در ۲۰۲۶-۱۰-۰۶ حدود ۱۰:۲۴ تا ۱۰:۳۲ UTC:

`QueryFailedError: duplicate key value violates unique constraint "UQ_c44ac33a05b144dd0d9ddcf9327"`

این ایندکس در پستگرس `UNIQUE (sku)` روی `products` است. `ProductService.create` فقط اسلاگ را قبل از درج چک می‌کرد و `23505` را به پاسخ کلاینت ترجمه نمی‌کرد. نس آن را `Internal server error` می‌کرد.

`find` / `exist` پیش‌فرض تایپ‌اُورم ردیف soft-delete را نمی‌بیند، ولی ایندکس یکتا آن را هم می‌گیرد.

## اصلاح

- قبل از درج، SKU زنده، حذف‌شده و alias چک می‌شود.
- اسلاگی که واقعاً ذخیره می‌شود (از جمله اسلاگ ساخته‌شده از SKU) هم چک می‌شود، با ردیف حذف‌شده.
- `allocateSku` همان اشغال را رد می‌کند.
- خطای `23505` با `Key (sku)` یا `Key (slug)` به ۴۰۰ برمی‌گردد، حتی اگر نام ایندکس هش تایپ‌اُورم باشد.

ایندکس یکتا عوض نشده است. SKU حذف‌شده همچنان قابل استفادهٔ دوباره نیست؛ فقط پیام روشن است.

## آزمون

`npx ts-node --transpile-only src/modules/product/product-unique.spec.ts` → OK

`npx tsc --noEmit` در `apps/api` فقط خطای قبلی `order-money-guard.spec.ts` را داد.
