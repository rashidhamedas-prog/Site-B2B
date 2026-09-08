import * as assert from 'node:assert/strict';
import { FALLBACK_RETAIL_SHIPPING_METHODS, resolveShippingMethods } from './shipping-methods';

assert.equal(resolveShippingMethods([], FALLBACK_RETAIL_SHIPPING_METHODS)[0].id, 'PISHTAZ');
assert.equal(
  resolveShippingMethods([{ id: 'TIPAX', label: 'تیپاکس' }], FALLBACK_RETAIL_SHIPPING_METHODS)[0].id,
  'TIPAX',
);
assert.equal(resolveShippingMethods(null, FALLBACK_RETAIL_SHIPPING_METHODS).length, 4);

console.log('shipping-methods.spec.ts: OK');
