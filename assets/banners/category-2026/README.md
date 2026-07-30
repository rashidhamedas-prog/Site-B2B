# Category banners 1:1 (retail homepage 3×3)

Square category tiles for the retail homepage `categoryBanners` CMS block.

## Public URLs (serve from Next.js)

| File | Suggested use |
|------|----------------|
| `/banners/category-2026/01-linen.png` | لینن |
| `/banners/category-2026/02-outerwear.png` | رویه / مانتو |
| `/banners/category-2026/03-sets.png` | ست |
| `/banners/category-2026/04-mint.png` | تابستانه |
| `/banners/category-2026/05-blouse.png` | شومیز |
| `/banners/category-2026/06-cream.png` | رسمی / کرم |
| `/banners/category-2026/07-jacket.png` | کت |
| `/banners/category-2026/08-plaid.png` | چهارخانه / کالکشن |
| `/banners/category-2026/09-blazer.png` | بلیزر |

Source copies also live under `assets/banners/category-2026/`.

## How to attach

1. Admin → `/admin/categories`
2. For each category, set **بنر ۱:۱** to one of the paths above (or upload a new square image)
3. Admin → `/admin/site-content` → کانال تکی → صفحه اصلی → block **بنر دسته‌بندی (۳×۳)**
4. Adjust `columns` (default 3), `maxItems` (default 9), optional `categoryIds`

## Notes

- Overlay category name is rendered in HTML/CSS — do not burn Persian text into the image.
- fal.ai generation was skipped (account balance exhausted); plates reused from hero-2026 / lifestyle intake.
- Brand palette: forest `#1B5C4A`, gold `#C9A84C`, cream `#F6F1E8`.
