import * as assert from 'node:assert/strict';
import { isIranMobile, normalizeIranMobile, resolveSmsOps, smsOpsEnabled } from './sms-ops';

const defaults = resolveSmsOps({});
assert.equal(smsOpsEnabled(defaults, 'RETAIL', 'orderPaidAdmin'), true);
assert.equal(smsOpsEnabled(defaults, 'WHOLESALE', 'abandonedCart'), true);

const offRetail = resolveSmsOps({ retail: { orderPaidAdmin: false }, wholesale: { orderPaidAdmin: true } });
assert.equal(smsOpsEnabled(offRetail, 'RETAIL', 'orderPaidAdmin'), false);
assert.equal(smsOpsEnabled(offRetail, 'WHOLESALE', 'orderPaidAdmin'), true);

assert.equal(isIranMobile('09152424624'), true);
assert.equal(isIranMobile('9152424624'), true);
assert.equal(isIranMobile('123'), false);
assert.equal(normalizeIranMobile('989152424624'), '09152424624');

console.log('sms-ops.spec.ts: OK');
