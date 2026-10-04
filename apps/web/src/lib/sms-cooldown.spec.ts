/**
 * npx ts-node --transpile-only src/lib/sms-cooldown.spec.ts
 */
import assert from 'node:assert/strict';
import { formatOtpValidity, readSmsCooldownSeconds } from './sms-cooldown.ts';

assert.equal(readSmsCooldownSeconds({ remainingSeconds: 12 }), 12);
assert.equal(readSmsCooldownSeconds(new Error('ارسال ناموفق')), null);
assert.equal(readSmsCooldownSeconds({ message: 'کد تایید ارسال شد' }), null);
assert.equal(formatOtpValidity(600), `${(10).toLocaleString('fa-IR')} دقیقه`);
assert.equal(formatOtpValidity(90), `${(1).toLocaleString('fa-IR')} دقیقه و ${(30).toLocaleString('fa-IR')} ثانیه`);

console.log('sms-cooldown.spec.ts ok');
