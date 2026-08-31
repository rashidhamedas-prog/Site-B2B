import assert from 'node:assert/strict';
import { defaultWholesaleColors, variantWholesale, wholesaleMoq, wholesaleOrderSummary } from './wholesale-order';

assert.equal(wholesaleMoq({ id: 'p0', name: 'بدون حداقل' }), 1);
assert.equal(wholesaleMoq({ id: 'p0', name: 'بدون حداقل', minOrderQty: undefined }), 1);

const product = {
  id: 'p1',
  name: 'تست',
  wholesalePrice: 1_000_000,
  minOrderQty: 6,
  allowWholesaleColorSelect: false,
  sizeType: 'TWO',
  variants: [
    { color: 'کرم', size: '۱', wholesaleStock: 10 },
    { color: 'کرم', size: '۲', wholesaleStock: 10 },
    { color: 'مشکی', size: '۱', wholesaleStock: 10 },
    { color: 'مشکی', size: '۲', wholesaleStock: 10 },
  ],
};

assert.equal(wholesaleMoq(product), 6);
assert.deepEqual(defaultWholesaleColors(product), ['کرم', 'مشکی']);

const summary = wholesaleOrderSummary(product, [], 2);
assert.equal(summary.packMode, true);
assert.equal(summary.piecesPerPack, 4);
assert.equal(summary.sizeCount, 2);
assert.equal(summary.totalPieces, 8);
assert.equal(summary.canOrder, true);
assert.equal(summary.unitPrice, 1_000_000);

const selectable = {
  ...product,
  allowWholesaleColorSelect: true,
  minWholesaleColors: 2,
};
assert.deepEqual(defaultWholesaleColors(selectable), []);
const blocked = wholesaleOrderSummary(selectable, ['کرم'], 2);
assert.equal(blocked.canOrder, false);
const ready = wholesaleOrderSummary(selectable, ['کرم', 'مشکی'], 2);
assert.equal(ready.canOrder, true);

const freeSize = wholesaleOrderSummary(
  {
    ...product,
    sizeType: 'FREE',
    minOrderQty: 1,
    variants: [
      { color: 'کرم', size: 'فری', wholesaleStock: 10 },
      { color: 'کرم', size: 'اضافی', wholesaleStock: 10 },
      { color: 'مشکی', size: 'فری', wholesaleStock: 10 },
    ],
  },
  [],
  1,
);
assert.equal(freeSize.piecesPerPack, 2);
assert.equal(freeSize.sizeCount, 1);

const fallbackSizes = wholesaleOrderSummary(
  {
    id: 'p2',
    name: 'بدون تایپ',
    wholesalePrice: 500,
    variants: [
      { color: 'آبی', size: '۱', wholesaleStock: 4 },
      { color: 'قرمز', size: '۱', wholesaleStock: 4 },
      { color: 'آبی', size: '۲', wholesaleStock: 4 },
      { color: 'قرمز', size: '۲', wholesaleStock: 4 },
    ],
  },
  [],
  1,
);
assert.equal(fallbackSizes.piecesPerPack, 4);

const dups = wholesaleOrderSummary(
  {
    id: 'p3',
    name: 'رنگ تکراری',
    sizeType: 'THREE',
    wholesalePrice: 500,
    variants: [
      { color: 'آبی', size: '۱', wholesaleStock: 3 },
      { color: ' آبی', size: '۲', wholesaleStock: 3 },
      { color: 'آبی', size: '۳', wholesaleStock: 3 },
    ],
  },
  [],
  1,
);
assert.equal(dups.piecesPerPack, 3);

const liveSale = wholesaleOrderSummary(
  {
    ...product,
    wholesalePrice: 800_000,
    sale: { active: true, payable: 800_000, original: 1_000_000, badgePercent: 20 },
  },
  [],
  1,
);
assert.equal(liveSale.unitPrice, 800_000);
assert.equal(liveSale.compareAt, 1_000_000);
assert.equal(liveSale.saleActive, true);

const expiredSale = wholesaleOrderSummary(
  {
    ...product,
    wholesalePrice: 800_000,
    sale: { active: false, payable: 1_000_000, original: null },
  },
  [],
  1,
);
assert.equal(expiredSale.unitPrice, 1_000_000);
assert.equal(expiredSale.saleActive, false);
assert.equal(expiredSale.compareAt, 0);

assert.equal(variantWholesale({ wholesaleStock: 0, stock: 80 }), 0, 'sold-out wholesale ignores legacy stock');
assert.equal(
  wholesaleOrderSummary({
    id: 'p-soldout',
    name: 'تمام',
    wholesalePrice: 1000,
    wholesaleStock: 0,
    stock: 80,
    variants: [{ color: 'کرم', size: '۱', wholesaleStock: 0, stock: 80 }],
  }, [], 1).totalStock,
  0,
);

console.log('wholesale-order.spec.ts OK');
