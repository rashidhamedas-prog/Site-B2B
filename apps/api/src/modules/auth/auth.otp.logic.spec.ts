/**
 * Pure unit checks for hardening helpers (no Nest bootstrap).
 * Imports production helpers from phone.util (SEC-002: no duplicated logic).
 * Prefer: npx ts-node --transpile-only src/modules/auth/auth.otp.logic.spec.ts
 */
import { allowDevOtpExpose, normalizePhone } from './phone.util';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(normalizePhone('09121234567') === '09121234567', 'local phone');
assert(normalizePhone('+989121234567') === '09121234567', 'intl phone');
assert(normalizePhone('9121234567') === '09121234567', 'missing zero');
assert(allowDevOtpExpose('production', 'true') === false, 'prod never exposes');
assert(allowDevOtpExpose('development', 'false') === false, 'dev flag off');
assert(allowDevOtpExpose('development', 'true') === true, 'dev flag on');

console.log('auth.otp.logic.spec.ts: OK');
