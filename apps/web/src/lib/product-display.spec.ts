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
  toman,
  uniqueByColor,
  uniqueSizes,
} from './product-display';

assert.equal(toman(1_620_000), (162000).toLocaleString('fa-IR'));
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

assert.equal(sizeCountForType('FREE'), 1);
assert.equal(sizeCountForType('TWO'), 2);
assert.equal(sizeCountForType('THREE'), 3);
assert.equal(sizeCountForType(undefined), null);
assert.equal(sizeCountForType(''), null);

assert.equal(piecesPerPackCount(['آبی', 'قرمز'], 'FREE'), 2);
assert.equal(piecesPerPackCount(['آبی', 'قرمز'], 'TWO'), 4);
assert.equal(piecesPerPackCount(['آبی', 'قرمز', 'سبز'], 'THREE'), 9);
assert.equal(piecesPerPackCount(['آبی', 'آبی'], 'THREE'), 3);
assert.equal(piecesPerPackCount(['آبی', 'قرمز'], undefined, ['۱', '۲']), 4);

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
