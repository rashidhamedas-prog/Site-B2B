/**
 * npx tsx src/lib/product-jsonld-brand.spec.ts
 */
import { jsonLdBrandNode, TARANOM_JSONLD_BRAND } from './product-jsonld-brand';
import assert from 'node:assert/strict';

assert.equal(jsonLdBrandNode({})?.name, TARANOM_JSONLD_BRAND);
assert.equal(jsonLdBrandNode({ brandName: 'کیف چرم' })?.name, 'کیف چرم');
assert.equal(jsonLdBrandNode({ hideDefaultBrand: true }), undefined);
assert.equal(
  jsonLdBrandNode({ brandName: 'کیف چرم', hideDefaultBrand: true })?.name,
  'کیف چرم',
);

console.log('product-jsonld-brand.spec.ts: ok');
