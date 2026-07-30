# زمینهٔ B2C داخل monorepo ترنم

دامنه تکی: **www.poshaktaranom.ir**  
دامنه عمده: **poshaktaranom.com**  
نقشه: `skill site b2c.md`

## معماری قفل

یک هسته (همین repo) + دو ویترین. موجودی و ادمین مشترک. قوانین خرید جدا.

## مسیر کد

| بخش | مسیر |
|-----|------|
| ویترین تکی | `apps/web/src/app/retail/` |
| کامپوننت‌ها | `apps/web/src/components/retail/` |
| سبد تکی | `apps/web/src/lib/retail-cart.ts` |
| کانال | `apps/web/src/lib/channel.ts` + `middleware.ts` |
| دیزاین | `design-system/b2c/MASTER.md` |

## پیش‌نمایش لوکال

بدون دامنهٔ `.ir`: باز کردن `/retail`

روی هاست `.ir`، middleware مسیر عمومی را به `/retail/*` بازنویسی می‌کند.

## صفحه اصلی تکی (قابل‌ویرایش در CMS)

ادمین: `/admin/site-content` → کانال **تکی** → **صفحه اصلی**

| بلوک | پیش‌فرض | تنظیمات |
|------|---------|---------|
| `products` | پربازدیدترین‌ها، `limit: 12`, `sort: views` | تعداد و مرتب‌سازی (views / newest / discounted) |
| `categoryBanners` | شبکه ۳×۳ | عنوان، ستون، maxItems، categoryIds اختیاری |

بازدید محصول با `POST /products/:id/view` از PDP ثبت می‌شود (`viewCount`).  
بنر هر دسته از `/admin/categories` (فیلد `bannerUrl`، تصاویر نمونه در `/banners/category-2026/`).

## مسیر خرید تکی (آماده)

1. `/retail` → فروشگاه
2. افزودن به سبد
3. `/retail/account` → OTP
4. `/retail/checkout` → سفارش با `type=RETAIL_WEBSITE`
5. ادمین → فیلتر کانال «تکی»
