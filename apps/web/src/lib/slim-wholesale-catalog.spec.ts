import assert from 'node:assert/strict';
import { slimWholesaleCatalogProduct } from './slim-wholesale-catalog';

const slim = slimWholesaleCatalogProduct({
  id: 'p1',
  name: 'مدل آزمایشی',
  slug: 'sample',
  sku: 'SKU1',
  fabric: 'لینن',
  wholesalePrice: 100,
  retailPrice: 200,
  retailStock: 9,
  wholesaleStock: 4,
  seoMeta: { description: 'should drop' },
  description: 'long',
  wholesaleFullContent: 'drop me',
  images: ['a.jpg', 'b.jpg', 'c.jpg'],
  status: 'ACTIVE',
  isNew: true,
  isPreOrder: false,
  sale: { active: true, payable: 90 },
  sizeType: 'FREE',
  minOrderQty: 6,
  variants: [
    { id: 'v1', color: 'سبز', colorHex: '#0f0', size: 'FREE', wholesaleStock: 2, retailStock: 8 },
  ],
});

assert.equal(slim.id, 'p1');
assert.equal(slim.wholesalePrice, 100);
assert.equal(slim.wholesaleStock, 4);
assert.equal(slim.seoMeta, undefined);
assert.equal(slim.description, undefined);
assert.equal(slim.retailPrice, undefined);
assert.equal((slim.images as string[]).length, 2);
assert.deepEqual(slim.variants, [
  { id: 'v1', color: 'سبز', colorHex: '#0f0', size: 'FREE', wholesaleStock: 2 },
]);

console.log('slim-wholesale-catalog.spec.ts ok');
