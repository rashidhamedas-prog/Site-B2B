# کلیک کارت محصول در کرومیوم

## علامت

روی ویترین زنده، کلیک هر کارت محصول (تکی، عمده، بوتیک) در مرورگرهای کرومیوم هیچ نمی‌کرد. کنسول: `Illegal invocation`.

## ریشه

`beginProductTransition` در `apps/web/src/components/motion/product-transition.ts` (PR #96، کامیت `533884a2`) متد `document.startViewTransition` را در متغیر محلی کپی می‌کرد، `preventDefault` می‌زد، بعد همان تابع را بدون `this` صدا می‌زد. کرومیوم برای متد بومی `Illegal invocation` پرتاب می‌کند. استثنا قبل از `router.push` می‌افتاد و چون پیش‌فرض کلیک لغو شده بود، خود لینک Next هم نمی‌رفت.

هر سه کارت همان تابع را از `onClick` لینک صدا می‌زنند:

- `RetailProductCard.tsx`
- `WholesaleProductCard.tsx`
- `BoutiqueProductCard.tsx`

## فیکس

متد روی خود `document` صدا زده می‌شود. `preventDefault` فقط بعد از شروع موفق است. اگر API نباشد یا پرتاب کند، نام `view-transition` پاک می‌شود و کلیک به ناوبری خود `<a>` / Next Link برمی‌گردد. مارکاپ کارت‌ها عوض نشده.

## تست

`apps/web/src/components/motion/product-transition.spec.ts` همان قرارداد کلیک Next Link را با سه حالت اجرا می‌کند: API هست و به `document` بسته است، API نیست، API `Illegal invocation` پرتاب می‌کند. هر سه دقیقاً یک‌بار به آدرس محصول می‌رسند. حالت پرتاب، نام گذار را بعد از شکست خالی می‌بیند.

Playwright در وابستگی‌های ریپو نیست؛ این سه شاخه با اسپک واحد پوشش داده شد.

## دیپلوی

merge نشده. دیپلوی تولید انجام نشد؛ merge به `master` روی ایران دیپلوی می‌کند و تأیید مالک لازم است.
