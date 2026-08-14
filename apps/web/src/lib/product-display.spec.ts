import assert from 'node:assert/strict';
import {
  discountPercent,
  mediaUrl,
  meetsMoq,
  packPieces,
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

console.log('product-display.spec.ts OK');
