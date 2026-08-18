/**
 * npx ts-node --transpile-only src/modules/product/product-content.spec.ts
 */
import {
  generateRetailProductContent,
  generateWholesaleProductContent,
  isLegacyCopiedContent,
  shouldFillChannelContent,
} from './product-content';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const base = {
  name: 'مانتو نازگل',
  description: 'توضیح کوتاه',
  specs: { fabricType: 'کتان', designDetails: 'یقه ایستاده' },
  sizeType: 'TWO' as const,
  colors: ['سرمه‌ای', 'کرم'],
  packQty: 4,
  minPackQty: 2,
  categoryName: 'مانتو',
  careInstructions: { wash: 'شستشو با آب سرد' },
};

{
  const retail = generateRetailProductContent(base);
  assert(retail.includes('مانتو نازگل'), 'retail names product');
  assert(retail.includes('کتان'), 'retail uses real fabric');
  assert(retail.includes('سرمه‌ای'), 'retail uses real colors');
  assert(retail.includes('شستشو با آب سرد'), 'retail uses real care');
  assert(!retail.includes('ابریشم'), 'retail does not invent fabric');
}

{
  const wholesale = generateWholesaleProductContent(base);
  assert(wholesale.includes('مانتو'), 'wholesale category');
  assert(wholesale.includes('4') || wholesale.includes('۴'), 'wholesale pack qty');
  assert(wholesale.includes('2') || wholesale.includes('۲'), 'wholesale min packs');
  assert(wholesale.includes('8') || wholesale.includes('۸'), 'wholesale min pieces');
  assert(!wholesale.includes('پرفروش‌ترین'), 'no unproven marketing claim');
}

{
  const sparse = generateRetailProductContent({ name: 'محصول ساده' });
  assert(sparse.includes('محصول ساده'), 'sparse still introduces name');
  assert(!sparse.includes('کتان'), 'no fabric invented');
}

assert(isLegacyCopiedContent('توضیح کوتاه', 'توضیح کوتاه') === true, 'legacy equal');
assert(isLegacyCopiedContent('متن دستی مدیر', 'توضیح کوتاه') === false, 'manual kept');
assert(shouldFillChannelContent({ name: 'x', retailFullContent: '' }, 'RETAIL', 'empty') === true, 'empty fill');
assert(
  shouldFillChannelContent(
    { name: 'x', retailFullContent: 'دستی', description: 'قدیمی' },
    'RETAIL',
    'empty',
  ) === false,
  'do not overwrite manual in empty mode',
);
assert(
  shouldFillChannelContent(
    { name: 'x', wholesaleFullContent: 'قدیمی', description: 'قدیمی' },
    'WHOLESALE',
    'legacy-equal',
  ) === true,
  'legacy-equal fill',
);

console.log('product-content.spec.ts OK');
