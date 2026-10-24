import assert from 'node:assert/strict';
import {
  channelSaleDisplay,
  discountPercent,
  mediaUrl,
  meetsMoq,
  packPieces,
  piecesPerPackCount,
  sizeCountForType,
  sizeTypeLabel,
  storefrontSizeLabels,
  toman,
  uniqueByColor,
  uniqueInStockColors,
  uniqueSizes,
  variantChannelStock,
  variantsInStock,
  variantsOnSizeChart,
} from './product-display';

assert.equal(toman(1_620_000), (162000).toLocaleString('fa-IR'));
assert.equal(toman(14_099_990), (1_410_000).toLocaleString('fa-IR'));
assert.equal(toman(12_580_000), (1_258_000).toLocaleString('fa-IR'));
assert.equal(discountPercent(1_620_000, 1_790_000), 9);
assert.equal(discountPercent(100, 100), 0);
assert.equal(discountPercent(0, 200), 0);
assert.equal(sizeTypeLabel('FREE'), 'فری‌سایز');
assert.equal(sizeTypeLabel('TWO'), '۲ سایز');
assert.equal(sizeTypeLabel('THREE'), '۳ سایز');
assert.equal(packPieces(3, 2), 6);
assert.equal(packPieces(0, 0), 1);
assert.equal(meetsMoq(6, 6), true);
assert.equal(meetsMoq(5, 6), false);
assert.equal(mediaUrl('uploads/a.jpg'), '/media/uploads/a.jpg');
assert.equal(mediaUrl('/media/a.jpg'), '/media/a.jpg');
assert.deepEqual(
  uniqueByColor([{ color: 'کرم' }, { color: 'کرم' }, { color: 'مشکی' }]).map((v) => v.color),
  ['کرم', 'مشکی'],
);
assert.deepEqual(uniqueSizes([{ size: '۱' }, { size: '۲' }, { size: '۱' }]), ['۱', '۲']);

{
  const leftover = [
    { size: '37', wholesaleStock: 2 },
    { size: 'فری سایز', wholesaleStock: 0 },
    { size: '40', wholesaleStock: 1 },
  ];
  const chart = { sizeType: 'CUSTOM', sizeLabels: ['37', '38', '39', '40'] };
  assert.deepEqual(
    variantsOnSizeChart(leftover, chart).map((v) => v.size),
    ['37', '40'],
  );
  assert.deepEqual(storefrontSizeLabels(leftover, chart, { channel: 'wholesale' }), ['37', '40']);
}

assert.equal(variantChannelStock({ wholesaleStock: 0, stock: 80 }, 'wholesale'), 0);
assert.equal(variantChannelStock({ retailStock: 0, wholesaleStock: 4 }, 'retail'), 0);
assert.equal(variantChannelStock({ retailStock: 2, wholesaleStock: 0 }, 'wholesale'), 0);
assert.equal(variantChannelStock({ stock: 3 }, 'retail'), 3);

const mixed = [
  { color: 'کرم', size: '۱', retailStock: 0, wholesaleStock: 2 },
  { color: 'کرم', size: '۲', retailStock: 0, wholesaleStock: 2 },
  { color: 'قهوه‌ای', size: '۱', retailStock: 1, wholesaleStock: 1 },
  { color: 'قهوه‌ای', size: '۲', retailStock: 0, wholesaleStock: 1 },
  { color: 'مشکی', size: '۱', retailStock: 0, wholesaleStock: 0 },
];
assert.deepEqual(
  uniqueInStockColors(mixed, 'retail').map((v) => v.color),
  ['قهوه‌ای'],
);
assert.deepEqual(
  uniqueInStockColors(mixed, 'wholesale').map((v) => v.color),
  ['کرم', 'قهوه‌ای'],
);
assert.equal(variantsInStock(mixed, 'retail').length, 2);
assert.deepEqual(
  uniqueInStockColors(mixed, 'retail', { includeSoldOut: true }).map((v) => v.color),
  ['کرم', 'قهوه‌ای', 'مشکی'],
);

assert.equal(sizeCountForType('FREE'), 1);
assert.equal(sizeCountForType('TWO'), 2);
assert.equal(sizeCountForType('THREE'), 3);
assert.equal(sizeCountForType('CUSTOM', ['۳۸', '۴۰']), 2);
assert.equal(sizeCountForType(undefined), null);
assert.equal(sizeCountForType(''), null);

assert.equal(piecesPerPackCount(['آبی', 'قرمز'], 'FREE'), 2);
assert.equal(piecesPerPackCount(['آبی', 'قرمز'], 'TWO'), 4);
assert.equal(piecesPerPackCount(['آبی', 'قرمز', 'سبز'], 'THREE'), 9);
assert.equal(piecesPerPackCount(['آبی', 'آبی'], 'THREE'), 3);
assert.equal(piecesPerPackCount(['آبی', 'قرمز'], undefined, ['۱', '۲']), 4);
assert.equal(
  piecesPerPackCount(['آبی', 'قرمز'], {
    sizeType: 'TWO',
    packDefinitionMode: 'MANUAL',
    packComposition: { 'سایز ۱': 2, 'سایز ۲': 1 },
  }),
  6,
);
assert.equal(
  piecesPerPackCount(['آبی'], {
    sizeType: 'CUSTOM',
    sizeLabels: ['S', 'M', 'L'],
    packDefinitionMode: 'AUTO',
  }),
  3,
);

const live = channelSaleDisplay({ active: true, payable: 800_000, original: 1_000_000, badgePercent: 20 }, 800_000);
assert.equal(live.price, 800_000);
assert.equal(live.compareAt, 1_000_000);
assert.equal(live.discount, 20);
assert.equal(live.active, true);

const expired = channelSaleDisplay({ active: false, payable: 1_000_000, original: null }, 800_000);
assert.equal(expired.price, 1_000_000);
assert.equal(expired.compareAt, 0);
assert.equal(expired.active, false);

assert.equal(channelSaleDisplay(undefined, 90).price, 90);

console.log('product-display.spec.ts OK');
