# حذف ابر چیپ دسته از هوم خرده‌فروشی

تاریخ: 2026-10-03  
وظیفه: TASK-20261003-008

## تصمیم

حذف، نه بازطراحی. ابر ۱۶ چیپ متنی زیر trust strip همان لینک‌های بلوک `categoryBanners` را تکرار می‌کرد و ظاهر ارزان/شلوغ می‌داد.

الگوی مرجع: کشف دسته با تایل تصویری محدود (نه فهرست کامل با وزن یکسان). هدر mega-nav هم محدودهٔ کامل دسته را دارد.

## تغییر

- `RetailBlocksRenderer`: دیگر `RetailHomeCategoryLinks` تزریق نمی‌کند
- فایل `RetailHomeCategoryLinks.tsx` حذف شد
- رگرسیون در `category-storefront.spec.mts`

دست‌نخورده: `RetailCategoryBannerGrid`، تم boutique (`BoutiqueCategoryRow`)، ادمین CMS، عمده.

## پذیرش

هوم `.ir` بعد از هیرو و نوار اعتماد، مستقیم به بلوک CATEGORIES می‌رسد؛ متن «اگر یک تکه برای خودتان می‌خواهید» در HTML نیست.
