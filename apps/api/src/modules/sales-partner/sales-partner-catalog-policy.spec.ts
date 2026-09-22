import {
  factualFacts,
  humanStockBand,
  isFactualCaption,
  partnerCopyText,
  shortPartnerBlurb,
  stockBand,
} from './sales-partner-catalog-policy';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(stockBand(0) === 'out_of_stock', 'zero stock');
assert(stockBand(2) === 'low', 'low stock');
assert(stockBand(8) === 'in_stock', 'in stock');
assert(humanStockBand('out_of_stock') === 'فعلاً ناموجود', 'human out');
assert(isFactualCaption('مانتو کرپ با یقه ایستاده') === true, 'factual ok');
assert(isFactualCaption('پرفروش‌ترین مانتو بازار') === false, 'claim blocked');
assert(shortPartnerBlurb('بهترین پارچه سال') === null, 'blurb strips claims');
assert(shortPartnerBlurb('پارچه کرپ سبک') === 'پارچه کرپ سبک', 'blurb keeps facts');

const facts = factualFacts({ fabricType: 'کرپ', sizeType: 'FREE' });
assert(facts.includes('جنس: کرپ') && facts.includes('سایز: فری‌سایز'), 'facts');

const copy = partnerCopyText({
  name: 'مانتو سارا',
  facts,
  priceTomanLabel: '۱٬۲۰۰٬۰۰۰ تومان',
  productUrl: 'https://poshaktaranom.ir/products/sara',
});
assert(copy.includes('مانتو سارا'), 'copy name');
assert(copy.includes('هنگام ثبت سفارش از سرور'), 'copy not price source');
assert(!copy.includes('پرفروش'), 'copy no claim');

console.log('sales-partner-catalog-policy.spec.ts: OK');
