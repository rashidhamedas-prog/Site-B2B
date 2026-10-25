import assert from 'node:assert/strict';
import { slimRetailCatalogProduct } from './server-api';
import { pickCatalogSizing, sizesForSizeType } from './product-display';

const raw = {
  id: 'p1',
  name: 'شلوار گلابی',
  slug: 'rose-bezayagh-pants',
  sku: 'SKU-1',
  fabric: 'لینن',
  retailPrice: 1_000_000,
  retailCompareAtPrice: null,
  images: ['a.jpg', 'b.jpg', 'c.jpg'],
  retailStock: 4,
  isNew: true,
  isPreOrder: false,
  sale: null,
  sizeType: 'THREE',
  sizeLabels: null,
  packDefinitionMode: 'AUTO',
  packComposition: { 'سایز ۱': 1, 'سایز ۲': 1, 'سایز ۳': 1 },
  variants: [
    { id: 'v1', color: 'کرم', colorHex: '#eee', size: 'سایز ۱', retailStock: 2, wholesaleStock: 9 },
  ],
  specs: { collarModel: 'گرد', fabricType: 'لینن', extra: 'drop' },
  heavy: 'omit',
};

const slim = slimRetailCatalogProduct(raw);

assert.equal(slim.sizeType, 'THREE');
assert.deepEqual(slim.sizeLabels, null);
assert.equal(slim.packDefinitionMode, 'AUTO');
assert.equal((slim.packComposition as Record<string, number>)['سایز ۳'], 1);
assert.equal(Array.isArray(slim.images) && (slim.images as string[]).length, 2);
assert.equal((slim.variants as unknown[]).length, 1);
assert.equal((slim.variants as Array<Record<string, unknown>>)[0]?.wholesaleStock, undefined);
assert.equal(slim.heavy, undefined);

const sizing = pickCatalogSizing(slim);
assert.equal(sizing.sizeType, 'THREE');
assert.deepEqual(sizesForSizeType(sizing.sizeType, sizing.sizeLabels), [
  'سایز ۱',
  'سایز ۲',
  'سایز ۳',
]);

const strippedLegacy = { ...slim };
delete (strippedLegacy as { sizeType?: unknown }).sizeType;
assert.deepEqual(sizesForSizeType(strippedLegacy.sizeType as undefined), []);

console.log('slim-retail-catalog.spec.ts OK');
