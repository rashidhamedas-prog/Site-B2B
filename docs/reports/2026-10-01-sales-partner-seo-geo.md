# SEO/GEO Decision Report — salesPartnership (RETAIL) — 2026-10-01

## Executive outcome

لندینگ همکار بازاریاب فقط برای تک‌فروشی (`www.poshaktaranom.ir/sales-partnership`) ایندکس می‌شود. متای کامل بدون ادعای درصد پورسانت/درآمد در CMS و DB قرار گرفت؛ تب اشتباه روی کانال عمده حذف شد.

حالت اجرا: `implement` (پر کردن قرارداد صفحه + ذخیره CMS)

## Scope & evidence

- Markets: fa-IR / retail affiliate recruitment
- Template: CMS `pageKey=salesPartnership` + hybrid `#apply`
- Official recheck: FAQ rich results متوقف‌اند → FAQ فقط محتوای visible؛ بدون وعده rich result
- Missing: GSC property snapshot این session خوانده نشد (N/A — تغییر metadata محلی/DB)

## Template contract

| فیلد | مقدار |
|---|---|
| Audience / task | جذب ثبت‌نام همکار بازاریاب؛ توضیح نقش بدون موجودی |
| Intent | commercial investigate / lead |
| URL | `/sales-partnership` (retail public) |
| Indexability | index,follow |
| Canonical | self → `https://www.poshaktaranom.ir/sales-partnership` |
| Schema | WebPage + BreadcrumbList (visible-aligned؛ بدون FAQ rich promise) |
| OG | hero-banner.webp |
| Owner | admin `/admin/site-content?channel=RETAIL&page=salesPartnership` |

## Delivery

| تغییر | acceptance |
|---|---|
| `CMS_RETAIL_ONLY` برای salesPartnership | در عمده دیده نمی‌شود |
| `getDefaultPageSeo` | title/desc/canonical/OG پر |
| Admin load/seed/defaults | SEO همراه محتوا |
| DB upsert RETAIL row | seo_title + canonical در production |

## QA

- [x] هیچ درصد پورسانت در meta نیست
- [x] canonical روی `.ir` نه `.com`
- [x] tsc apps/web پاس
- [ ] پس از deploy وب: ادمین RETAIL فیلدها را پر نشان دهد؛ hard refresh صفحه عمومی

## Measurement / next review

- پس از ایندکس: GSC Performance برای `/sales-partnership` (impressions/CTR) — بدون تضمین رتبه
- اگر ادمین SEO را خالی کرد، fallback کد در `generateMetadata` باقی است
