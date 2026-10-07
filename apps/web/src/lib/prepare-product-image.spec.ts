/**
 * npx tsx src/lib/prepare-product-image.spec.ts
 */
import assert from 'node:assert/strict';
import { fitInside, shouldPrepareProductImage, SKIP_PREPARE_BYTES } from './prepare-product-image.ts';

assert.deepEqual(fitInside(1200, 1600), { width: 1200, height: 1600 });
assert.deepEqual(fitInside(2400, 3200), { width: 1200, height: 1600 });
assert.deepEqual(fitInside(8064, 6048), { width: 1200, height: 900 });
assert.deepEqual(fitInside(800, 600), { width: 800, height: 600 });
assert.deepEqual(fitInside(0, 10), { width: 1200, height: 1600 });

assert.equal(shouldPrepareProductImage({ type: 'image/jpeg', size: SKIP_PREPARE_BYTES + 1 }), true);
assert.equal(shouldPrepareProductImage({ type: 'image/jpeg', size: 100_000 }), false);
assert.equal(shouldPrepareProductImage({ type: 'image/gif', size: SKIP_PREPARE_BYTES + 1 }), false);
assert.equal(shouldPrepareProductImage({ type: 'image/heic', size: 200_000 }), true);

console.log('prepare-product-image.spec.ts: ok');
