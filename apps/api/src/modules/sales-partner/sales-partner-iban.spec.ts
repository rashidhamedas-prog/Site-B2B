import { cipherIban, decipherIban, fingerprintIban, ibanRecord, requireDedicatedIbanKey, resolveIbanSecret } from './sales-partner-iban';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const secret = 'test-secret-at-least-16';
const iban = 'IR120170000000123456789001';
const rec = ibanRecord(iban, secret);
assert(rec.ibanLast4 === '9001', 'last4');
assert(rec.ibanFingerprint === fingerprintIban(iban, secret), 'fp');
assert(decipherIban(rec.ibanCipher, secret) === iban, 'roundtrip');
assert(cipherIban(iban, secret) !== cipherIban(iban, secret), 'gcm iv unique');
assert(resolveIbanSecret('jwt-secret-long-enough') === 'jwt-secret-long-enough', 'fallback');
requireDedicatedIbanKey('development');
try {
  requireDedicatedIbanKey('production');
  throw new Error('prod without dedicated key should fail');
} catch (err) {
  assert(err instanceof Error && err.message === 'SALES_PARTNER_IBAN_KEY_REQUIRED', 'prod key required');
}
requireDedicatedIbanKey('production', 'dedicated-iban-key-16');
try {
  resolveIbanSecret('short');
  throw new Error('short secret should fail');
} catch (err) {
  assert(err instanceof Error && err.message === 'IBAN_SECRET_MISSING', 'refuse short');
}

console.log('sales-partner-iban.spec.ts: OK');
