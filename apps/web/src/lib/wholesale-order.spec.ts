import assert from 'node:assert/strict';
import { defaultWholesaleColors, wholesaleMoq, wholesaleOrderSummary } from './wholesale-order';

const product = {
  id: 'p1',
  name: 'تست',
  wholesalePrice: 1_000_000,
  minOrderQty: 6,
  allowWholesaleColorSelect: false,
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
assert.equal(summary.totalPieces, 8);
assert.equal(summary.canOrder, true);

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

console.log('wholesale-order.spec.ts OK');
