import assert from 'node:assert/strict';
import { formatSizePhrase, stockRemainingCopy } from './retail-size-label';

assert.equal(formatSizePhrase('۱'), 'سایز ۱');
assert.equal(formatSizePhrase('سایز ۱'), 'سایز ۱');
assert.equal(formatSizePhrase('سایز ۲'), 'سایز ۲');
assert.equal(formatSizePhrase('سایز۲'), 'سایز۲');
assert.equal(formatSizePhrase(''), '');
assert.equal(stockRemainingCopy(3, 'سایز ۱'), 'فقط ۳ عدد از سایز ۱');
assert.equal(stockRemainingCopy(3, '۱'), 'فقط ۳ عدد از سایز ۱');
assert.equal(stockRemainingCopy(10, 'سایز ۱'), 'موجود');
assert.equal(stockRemainingCopy(0, 'سایز ۱'), 'ناموجود');

console.log('retail-size-label.spec.ts: ok');
