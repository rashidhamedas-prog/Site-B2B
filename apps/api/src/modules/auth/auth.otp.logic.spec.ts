/**
 * Pure unit checks for hardening helpers (no Nest bootstrap).
 * Run: node --import ts-node/register/esm  OR compile first
 * Prefer: npx ts-node --transpile-only apps/api/src/modules/auth/auth.otp.logic.spec.ts
 *
 * For CI without jest deps yet, this file documents expected OTP fail-closed rules.
 */

function normalizePhone(raw: string): string {
  const digits = String(raw || '')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/\D/g, '');
  if (digits.startsWith('98') && digits.length === 12) return `0${digits.slice(2)}`;
  if (digits.length === 10 && digits.startsWith('9')) return `0${digits}`;
  return digits;
}

function allowDevOtpExpose(nodeEnv: string, flag: string): boolean {
  if (nodeEnv === 'production') return false;
  return String(flag).toLowerCase() === 'true';
}

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
