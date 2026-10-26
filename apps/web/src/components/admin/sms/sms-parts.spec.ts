import * as assert from 'node:assert/strict';
import { countSmsParts, ensureOptOutFooter, normalizeTypedCount } from './sms-parts';

assert.strictEqual(countSmsParts('ا'.repeat(70)), 1);
assert.strictEqual(countSmsParts('ا'.repeat(71)), 2);
assert.ok(ensureOptOutFooter('تبلیغ', 'PROMO').endsWith('لغو11'));
assert.strictEqual(ensureOptOutFooter('کد', 'OTP'), 'کد');
assert.strictEqual(normalizeTypedCount('۱٬۲۰۰'), 1200);
assert.strictEqual(normalizeTypedCount('1200'), 1200);

console.log('sms-parts.spec.ts: OK');
