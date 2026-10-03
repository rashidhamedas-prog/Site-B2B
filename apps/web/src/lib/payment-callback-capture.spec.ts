/**
 * npx ts-node --transpile-only src/lib/payment-callback-capture.spec.ts
 */
import assert from 'node:assert/strict';
import { verifyBodyFromCallbackParams } from './payment-callback-capture';

const digi = verifyBodyFromCallbackParams(
  new URLSearchParams({
    paymentId: 'pay-1',
    trackingCode: 'trk',
    providerId: 'pay-1',
    result: '0',
    type: '11',
  }),
);
assert.equal(digi?.paymentId, 'pay-1');
assert.equal(digi?.status, 'OK');
assert.equal(digi?.trackingCode, 'trk');

const torob = verifyBodyFromCallbackParams(
  new URLSearchParams({
    paymentId: 'pay-2',
    state: 'OK',
    transactionId: 'tx-9',
  }),
);
assert.equal(torob?.status, 'OK');
assert.equal(torob?.state, 'OK');
assert.equal(torob?.transactionId, 'tx-9');

assert.equal(verifyBodyFromCallbackParams(new URLSearchParams({ foo: '1' })), null);

console.log('payment-callback-capture.spec.ts: ok');
