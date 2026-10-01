# گزارش: لندینگ همکار بازاریاب (Retail)

تاریخ: 2026-10-01  
تسک: TASK-20261001-002  
شاخه: `ai/TASK-20261001-002-sales-partner-landing`

## هدف

صفحه جذب ثبت‌نام همکار بازاریاب روی `poshaktaranom.ir` با منوی هدر، چند بخش حرفه‌ای، اینفوگرافی مراحل، چند CTA به فرم، مقاله کوتاه، سئو، و ویرایش از ادمین — بدون ادعای ساختگی درصد/درآمد.

## تغییرات

| حوزه | جزئیات |
|------|--------|
| مسیر | `/sales-partnership` → `/retail/sales-partnership` via host rewrite؛ terms زیر همان درخت |
| CMS | `pageKey=salesPartnership` در allowlist + defaults کامل |
| رندر | `RetailFeatureCards` + `RetailProcessSteps`؛ ادمین فیلد `image`/`imageAlt` مرحله و `headingAs` برای CTA |
| فرم | `SalesPartnershipApply` به‌صورت section با `id=apply` (بدون H1 تکراری) |
| ناوبری | Retail + Boutique header/footer |
| دارایی | ۵ SVG در `/sales-partner/steps/` |
| سئو | metadata CMS، JSON-LD، sitemap، canonical |

## غیرهدف / محدودیت

- درصد پورسانت PROGRAM هنوز ops residual است → در کپی عدد اعلام نشد.
- Vendor `/partners` و weblog جدا دست نخورده‌اند.
- نظرات جعلی ساخته نشد.

## اعتبارسنجی

- `cd apps/web && npx tsc --noEmit` → 0
- Live verify پس از deploy: `/sales-partnership` 200، لینک هدر، H1، `#apply`

## ادمین

`/admin/site-content?channel=RETAIL&page=salesPartnership`
