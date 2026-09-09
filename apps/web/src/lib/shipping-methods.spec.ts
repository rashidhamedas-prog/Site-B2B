import * as assert from 'node:assert/strict';
import {
  FALLBACK_RETAIL_SHIPPING_METHODS,
  IN_PERSON_SHIPPING_ID,
  isInPersonShipping,
  resolveShippingMethods,
  shippingChoiceDescription,
} from './shipping-methods';

assert.equal(resolveShippingMethods([], FALLBACK_RETAIL_SHIPPING_METHODS).length, 0);
assert.equal(
  resolveShippingMethods([{ id: 'TIPAX', label: 'تیپاکس' }], FALLBACK_RETAIL_SHIPPING_METHODS)[0].id,
  'TIPAX',
);
assert.equal(resolveShippingMethods(null, FALLBACK_RETAIL_SHIPPING_METHODS).length, 5);
assert.equal(
  resolveShippingMethods(
    [
      { id: 'PISHTAZ', label: 'پست پیشتاز' },
      { id: 'TIPAX', label: 'تیپاکس' },
    ],
    FALLBACK_RETAIL_SHIPPING_METHODS,
  ).some((m) => m.id === IN_PERSON_SHIPPING_ID),
  false,
);
assert.equal(
  FALLBACK_RETAIL_SHIPPING_METHODS.some((m) => m.id === IN_PERSON_SHIPPING_ID),
  true,
);
assert.equal(
  shippingChoiceDescription(IN_PERSON_SHIPPING_ID, { freeShipping: true }),
  'بدون هزینه ارسال — مراجعه به فروشگاه یا کارگاه',
);
assert.equal(isInPersonShipping('in_person'), true);
assert.match(shippingChoiceDescription('TIPAX', { freeShipping: true }), /رایگان/);

console.log('shipping-methods.spec.ts: OK');
