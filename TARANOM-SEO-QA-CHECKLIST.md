# Taranom SEO QA checklist — 2026-08-17

Use this after deploy. Mark only what you actually checked.

## Wholesale card

- [ ] Catalog cards no longer show «حداقل سفارش X عدد» or «موجودی X عدد»
- [ ] Color swatches and «N رنگ» still show
- [ ] Size line still shows فری‌سایز / ۲ سایز / ۳ سایز via `sizeTypeLabel`
- [ ] Related / PDP still shows the product’s exact `minOrderQty`

## Public min-order copy

- [ ] Header fallback (when CMS announcement is empty) says «حداقل سفارش در محصول از 6 عدد به بالا می باشد.»
- [ ] Wholesale FAQ default answer uses the same 6+ sentence
- [ ] If live header still says ۵, the CMS announcement row was not updated (expected; `cms/defaults.ts` was out of scope)
- [ ] Product descriptions were not bulk-rewritten

## Retail PDP schema

- [ ] View-source: Product `@id` ends with `#product`
- [ ] `Offer.price` equals active `sale.payable` (IRR), not an expired sale
- [ ] `itemCondition` is NewCondition; brand is پوشاک ترنم
- [ ] If the product has 2+ colors or 2+ sizes, a ProductGroup exists with `variesBy` and `hasVariant` and **no extra variant URLs**

## Wholesale PDP schema

- [ ] Guest HTML does **not** put a wholesale price in Offer
- [ ] Availability / MOQ property may still be present

## Related products

- [ ] When `relatedProducts[]` is set: H2 «محصولات مرتبط»
- [ ] Retail subtitle: «مدل‌هایی که ممکن است دوست داشته باشید»
- [ ] Wholesale subtitle: «مدل‌های پیشنهادی برای تکمیل خرید عمده»
- [ ] Each card/link is a real `href` to `/products/{slug}`
- [ ] When related is empty, fallback `relatedTo` list still appears (same as before)

## Sale display

- [ ] Active sale: badge uses `sale.badgePercent` (or compare-at math if `sale` is missing)
- [ ] Expired / not-started sale: badge hidden; price is not the lapsed discount
- [ ] Cart add uses payable price

## Google Merchant

- [ ] `GET {API}/v1/feeds/google-merchant.xml` is 200 RSS with `g:` fields
- [ ] `link` is `https://www.poshaktaranom.ir/products/{slug}`
- [ ] `image_link` is absolute https
- [ ] `sale_price` only when sale is active
- [ ] Draft / `showOnRetail=false` products are absent
- [ ] Web proxy `/feeds/google-merchant.xml` — confirm host: may 404 on `.ir` until middleware exempts `/feeds`

## Audit script

- [ ] `npm run seo:audit` writes `reports/seo-audit.md` and `reports/seo-audit.json`
- [ ] If live fetch failed, findings say SKIPPED — do not mark PASS

## Out of this lane (do not fail this implementer for these)

- [ ] Admin discount / related / dual-content UI
- [ ] `/category/{slug}` + UUID 301
- [ ] Sitemap index without query/404/noindex URLs
- [ ] About + Mashhad landing
