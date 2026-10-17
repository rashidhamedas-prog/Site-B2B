# دسته‌بندی عمده روی ویترین زنده

## Symptom

`poshaktaranom.com` had no product-category index. The public API still returned 17 ACTIVE categories (including شومیز).

## Root cause

1. `WholesaleBlocksRenderer` discarded `categoryBanners` as retail-only.
2. The saved wholesale home document has no category block, and defaults apply only when that document is empty.
3. `showOnHome` is the retail home-grid flag. Seven active categories, including شومیز, are unchecked. A wholesale index that reused that flag would hide them.
4. The image-grid cap of 16 would also drop شومیز, because API order (`sortOrder`) puts it last.

## Fix

- Saved wholesale home pages gain a category block after the hero when editors have not added one. An existing block is left as saved.
- The wholesale index lists every ACTIVE category, up to 24 text rows. Retail `showOnHome` and the 16-image cap stay retail-only.
- Header «دسته‌بندی» and the mobile menu use the same list. The nav fetch streams in `Suspense` so it does not sit on the header's response path.
- Home tiles may show a 48px lazy thumb. `/products` is text-only so those thumbs do not compete with the catalog.
- Hiding a category from wholesale is still `status: HIDDEN`.

## Check

- `node --experimental-strip-types src/lib/catalog/category-storefront.spec.mts`
