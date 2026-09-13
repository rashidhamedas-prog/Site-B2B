/**
 * npx ts-node --transpile-only src/modules/settings/settings-payment-cash.spec.ts
 */
import * as assert from 'node:assert/strict';
import {
  allowedOrderPaymentMethods,
  isCashOnDeliveryEnabled,
  resolveCashOnDeliveryFlags,
} from './settings-payment-cash';

const unset = resolveCashOnDeliveryFlags({});
assert.equal(unset.retailCashEnabled, false, 'retail COD unset is off');
assert.equal(unset.wholesaleCashEnabled, true, 'wholesale cash unset stays on');
assert.equal(isCashOnDeliveryEnabled('RETAIL', unset), false);
assert.equal(isCashOnDeliveryEnabled('WHOLESALE', unset), true);
assert.deepEqual(allowedOrderPaymentMethods('RETAIL', unset), ['ONLINE']);
assert.deepEqual(allowedOrderPaymentMethods('WHOLESALE', unset), [
  'CASH',
  'INSTALLMENT',
  'ONLINE',
]);

const bothOn = resolveCashOnDeliveryFlags({
  retailCashEnabled: true,
  wholesaleCashEnabled: true,
});
assert.deepEqual(allowedOrderPaymentMethods('RETAIL', bothOn), ['CASH', 'ONLINE']);

const bothOff = resolveCashOnDeliveryFlags({
  retailCashEnabled: false,
  wholesaleCashEnabled: false,
});
assert.equal(isCashOnDeliveryEnabled('RETAIL', bothOff), false);
assert.equal(isCashOnDeliveryEnabled('WHOLESALE', bothOff), false);
assert.deepEqual(allowedOrderPaymentMethods('WHOLESALE', bothOff), [
  'INSTALLMENT',
  'ONLINE',
]);

assert.equal(isCashOnDeliveryEnabled('RETAIL', null), false);
assert.equal(isCashOnDeliveryEnabled('WHOLESALE', null), true);

console.log('settings-payment-cash spec ok');
