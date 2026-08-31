# Owner follow-through — CTA، اریکا، ISR کاتالوگ عمده

تاریخ: ۱ شهریور ۱۴۰۵ / 2026-09-01  
وظیفه: TASK-20260901-001

## چه کار شد

- فال‌بک CTA هوم تکی در `RetailBlocksRenderer` با همان متن تأییدشدهٔ `defaults.ts` عوض شد (بوتیک دارید / سایت بوتیک‌داران).
- اسکریپت SQL فقط FAQ+CTA را به ردیف CMS هوم تکی اضافه می‌کند؛ هیرو و بنر بازنویسی نمی‌شود.
- اسلاگ اشتباه اریکا (`linen-shirt-manteau-erika`) به اسلاگ زنده (`linen-sport-jacket-erika`) نگاشت شد. محصول ACTIVE است؛ ۴۰۴ از اسلاگ بود نه unpublished.
- `/products` عمده بدون `searchParams`، `force-static` + `revalidate=60` است. فیلترها کلاینتی و `noindex,follow` هستند. payload کارت‌ها بدون `seoMeta` و فیلدهای تکی.
- `ProductCatalog.tsx` و `server-api.ts` دست نخورده ماندند (claim همان‌روز TASK-20260826-001).

## GSC / GA4

- Merchant تکی: ۲۷ آیتم Invalid، فقط `Missing field "image"`؛ last update 8/30/26. نمونهٔ رستا last crawled Aug 31.
- PDP سارا با اسلاگ `shomiz-linen-sara` در URL Inspection «unknown to Google» است (Last crawl N/A). در لیست ۲۷ آیتم image نیست.
- Validate Fix روی image فقط وقتی زده می‌شود که ایندکس سارا یا حداقل یک PDP پول بعد از فیکس JSON-LD recrawl شده باشد.
- روی `/account`، ریدایرکت، ۴۰۴ وردپرس، HTTP، سیاست مرجوعی و shipping Validate Fix زده نشد.
- استریم GA4 `547352333` از این لاگین Analytics دسترسی Admin ندارد (Missing permissions). تغییر نام Retail → Wholesale از UI ممکن نشد.

## گیت

شاخه: `ai/TASK-20260901-001-followthrough`
