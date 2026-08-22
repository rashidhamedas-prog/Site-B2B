/**
 * npx ts-node --transpile-only src/modules/product/catalog-excel.spec.ts
 */
import {
  buildCategoryWorkbook,
  buildProductWorkbook,
  irrToToman,
  parseExportChannel,
  yesNo,
} from './catalog-excel';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(parseExportChannel('wholesale') === 'WHOLESALE', 'wholesale channel');
assert(parseExportChannel('RETAIL') === 'RETAIL', 'retail channel');
assert(parseExportChannel(undefined) === 'ALL', 'default all');
let threw = false;
try {
  parseExportChannel('shop');
} catch {
  threw = true;
}
assert(threw, 'invalid channel throws');

assert(irrToToman(1_250_000) === 125000, 'irr to toman');
assert(irrToToman(null) === '', 'null irr');
assert(yesNo(true) === 'بله', 'yes');
assert(yesNo(false) === 'خیر', 'no');

const productBook = buildProductWorkbook({
  channel: 'WHOLESALE',
  products: [
    {
      id: 'p1',
      sku: 'LINEN-1',
      slug: 'linen-coat',
      name: 'مانتو لینن',
      status: 'ACTIVE',
      showOnWholesale: true,
      showOnRetail: false,
      wholesalePrice: 2_500_000,
      retailPrice: 3_200_000,
      wholesaleCompareAtPrice: 3_000_000,
      wholesaleIsDiscounted: true,
      wholesaleDiscountType: 'PERCENT',
      wholesaleDiscountPercent: 17,
      minOrderQty: 2,
      sizeType: 'TWO',
      category: { name: 'شومیز', slug: 'shomiz' },
      variants: [
        { color: 'سفید', colorHex: '#fff', size: 'سایز ۱', wholesaleStock: 4, retailStock: 1, barcode: '111' },
        { color: 'سفید', colorHex: '#fff', size: 'سایز ۲', wholesaleStock: 2, retailStock: 0 },
        { color: 'مشکی', colorHex: '#000', size: 'سایز ۱', wholesaleStock: 3, retailStock: 2 },
        { color: 'مشکی', colorHex: '#000', size: 'سایز ۲', wholesaleStock: 1, retailStock: 0 },
      ],
      relatedSkus: ['LINEN-2'],
      seoMeta: { wholesaleTitle: 'خرید عمده مانتو لینن' },
    },
    {
      id: 'p2',
      sku: 'HIDDEN',
      slug: 'hidden',
      name: 'فقط تکی',
      status: 'ACTIVE',
      showOnWholesale: false,
      showOnRetail: true,
      wholesalePrice: 1000,
      variants: [],
    },
  ],
});

assert(productBook.filename.includes('wholesale'), 'wholesale filename');
assert(productBook.buffer.includes(Buffer.from('LINEN-1', 'utf8')), 'sku present');
assert(productBook.buffer.includes(Buffer.from('مانتو لینن', 'utf8')), 'persian name');
assert(
  productBook.buffer.includes(Buffer.from('https://poshaktaranom.com/products/linen-coat', 'utf8')),
  'wholesale url',
);
assert(
  productBook.buffer.includes(
    Buffer.from('https://www.poshaktaranom.ir/products/linen-coat', 'utf8'),
  ),
  'retail url',
);
assert(
  !productBook.buffer.includes(Buffer.from('HIDDEN', 'utf8')),
  'retail-only product excluded from wholesale export',
);
assert(productBook.buffer.includes(Buffer.from('<v>250000</v>', 'utf8')), 'wholesale toman numeric');
assert(productBook.buffer.includes(Buffer.from('<v>8</v>', 'utf8')), 'min pieces = 2 packs x 4');

const categoryBook = buildCategoryWorkbook({
  channel: 'RETAIL',
  categories: [
    {
      id: 'c1',
      name: 'شومیز',
      slug: 'shomiz',
      skuPrefix: 'SH-',
      nextSequence: 12,
      productCount: 7,
      seoTitle: 'خرید شومیز زنانه',
      wholesaleSeoTitle: 'خرید عمده شومیز',
    },
  ],
});
assert(categoryBook.filename.includes('retail'), 'retail filename');
assert(
  categoryBook.buffer.includes(Buffer.from('https://www.poshaktaranom.ir/category/shomiz', 'utf8')),
  'retail category url',
);
assert(categoryBook.buffer.includes(Buffer.from('خرید شومیز زنانه', 'utf8')), 'retail seo title');
assert(categoryBook.buffer.includes(Buffer.from('<v>7</v>', 'utf8')), 'product count numeric');

console.log('catalog-excel.spec.ts OK');
