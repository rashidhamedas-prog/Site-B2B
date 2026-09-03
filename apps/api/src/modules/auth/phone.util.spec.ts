/**
 * Prefer: npx ts-node --transpile-only src/modules/auth/phone.util.spec.ts
 */
import { normalizeOtpCode, normalizePhone } from './phone.util';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(normalizePhone('۰۹۱۵۱۲۳۴۵۶۷') === '09151234567', 'persian phone');
assert(normalizePhone('٠٩١٥١٢٣٤٥٦٧') === '09151234567', 'arabic-indic phone');
assert(normalizeOtpCode('۱۲۳۴۵۶') === '123456', 'persian otp');
assert(normalizeOtpCode('١٢٣٤٥٦') === '123456', 'arabic-indic otp');

console.log('phone.util.spec.ts: OK');
