import { cipherIban, decipherIban, fingerprintIban, ibanRecord, resolveIbanSecret } from './sales-partner-iban';

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
try {
  resolveIbanSecret('short');
  throw new Error('short secret should fail');
} catch (err) {
  assert(err instanceof Error && err.message === 'IBAN_SECRET_MISSING', 'refuse short');
}

console.log('sales-partner-iban.spec.ts: OK');
