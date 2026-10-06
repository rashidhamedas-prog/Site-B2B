/**
 * npx ts-node --transpile-only src/modules/product/product-unique.spec.ts
 */
import { BadRequestException } from '@nestjs/common';
import {
  insertProductSlug,
  PRODUCT_SKU_TAKEN,
  PRODUCT_SLUG_TAKEN,
  PRODUCT_UNIQUE_GENERIC,
  productUniqueMessage,
  throwProductUniqueOrRethrow,
} from './product-unique';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const productionSkuViolation = {
  message: 'duplicate key value violates unique constraint "UQ_c44ac33a05b144dd0d9ddcf9327"',
  driverError: {
    code: '23505',
    constraint: 'UQ_c44ac33a05b144dd0d9ddcf9327',
    detail: 'Key (sku)=(COATS00001) already exists.',
    table: 'products',
  },
};

assert(
  productUniqueMessage(productionSkuViolation) === PRODUCT_SKU_TAKEN,
  'live sku hash maps to sku message'
);

assert(
  productUniqueMessage({
    driverError: {
      code: '23505',
      detail: 'Key (slug)=(manto-bahar) already exists.',
      constraint: 'UQ_products_slug',
    },
  }) === PRODUCT_SLUG_TAKEN,
  'slug unique'
);

assert(
  productUniqueMessage({
    driverError: {
      code: '23505',
      detail: 'Key (productId)=(x) already exists.',
      constraint: 'UQ_other',
      table: 'product_category_membership',
    },
  }) === PRODUCT_UNIQUE_GENERIC,
  'other unique is not a 500'
);

assert(productUniqueMessage({ code: '23503', detail: 'fk' }) === null, 'foreign key is rethrown');

let mapped: unknown;
try {
  throwProductUniqueOrRethrow(productionSkuViolation);
} catch (err) {
  mapped = err;
}
assert(mapped instanceof BadRequestException, 'sku violation becomes 400');
assert((mapped as BadRequestException).message === PRODUCT_SKU_TAKEN, '400 keeps sku copy');

let rethrown: unknown;
try {
  throwProductUniqueOrRethrow(new Error('connection reset'));
} catch (err) {
  rethrown = err;
}
assert(
  rethrown instanceof Error && !(rethrown instanceof BadRequestException),
  'unknown errors stay unknown'
);

assert(insertProductSlug({ sku: 'COATS00001' }) === 'coats00001', 'blank slug follows sku');
assert(
  insertProductSlug({ sku: 'COATS00001', slug: 'Manto-Bahar' }) === 'manto-bahar',
  'explicit slug wins'
);
assert(
  insertProductSlug({ sku: 'COATS00001', slug: '   ' }) === 'coats00001',
  'whitespace slug follows sku'
);

console.log('product-unique.spec.ts: OK');
