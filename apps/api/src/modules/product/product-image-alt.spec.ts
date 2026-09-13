/**
 * npx ts-node --transpile-only src/modules/product/product-image-alt.spec.ts
 */
import * as assert from 'node:assert/strict';
import {
  normalizeProductImageAlts,
  suggestProductImageAlt,
  fillMissingProductImageAlts,
} from './product-image-alt';

assert.deepEqual(normalizeProductImageAlts(['x']), {});
assert.deepEqual(
  normalizeProductImageAlts({
    'https://cdn.example/a.jpg': '  آلت  ',
    'javascript:alert(1)': 'بد',
  }),
  { 'https://cdn.example/a.jpg': 'آلت' },
);

assert.equal(suggestProductImageAlt({ name: 'مانتو سارا', index: 0 }), 'مانتو سارا از روبرو');

const filled = fillMissingProductImageAlts({
  images: ['/a.jpg', '/b.jpg'],
  imageAlts: { '/a.jpg': 'آلت دستی' },
  name: 'مانتو سارا',
  colorByUrl: { '/b.jpg': 'مشکی' },
});
assert.equal(filled['/a.jpg'], 'آلت دستی');
assert.equal(filled['/b.jpg'], 'مانتو سارا — رنگ مشکی');

console.log('product-image-alt.spec.ts: ok');
