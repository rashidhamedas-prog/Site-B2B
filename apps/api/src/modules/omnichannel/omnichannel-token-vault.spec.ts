/**
 * npx ts-node --transpile-only src/modules/omnichannel/omnichannel-token-vault.spec.ts
 */
import {
  applyVaultOverlay,
  assertNoVaultLeak,
  assertTokenShape,
  decryptToken,
  deriveVaultKey,
  encryptToken,
  isProductionLike,
  parseStoredVault,
  peekVaultToken,
  providerFromSecretRef,
  publicSecretStatus,
  setVaultOverlayEntry,
  tokenFingerprint,
} from './omnichannel-token-vault';
import { resolveProviderToken } from './adapters/telegram.adapter';
import { secretRefConfigured } from './provider-capabilities';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const prevJwt = process.env.JWT_SECRET;
const prevVaultKey = process.env.OMNICHANNEL_VAULT_KEY;
const prevNode = process.env.NODE_ENV;
const prevApp = process.env.APP_ENV;
delete process.env.OMNICHANNEL_VAULT_KEY;
delete process.env.APP_ENV;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'vault-spec-jwt-secret-value';

assert(isProductionLike({ NODE_ENV: 'production' }) === true, 'prod is production-like');
assert(isProductionLike({ NODE_ENV: 'test' }) === false, 'test is not production-like');
let prodMissing = false;
try {
  deriveVaultKey({ NODE_ENV: 'production', JWT_SECRET: 'vault-spec-jwt-secret-value-32ch' });
} catch (err) {
  prodMissing = err instanceof Error && err.message === 'vault_key_missing';
}
assert(prodMissing, 'production refuses JWT as vault KEK');
const dedicated = deriveVaultKey({ NODE_ENV: 'production', OMNICHANNEL_VAULT_KEY: 'omnichannel-vault-key-32-chars-min' });
assert(Buffer.isBuffer(dedicated) && dedicated.length === 32, 'production accepts dedicated key');

const key = deriveVaultKey();
const token = '123456:AA-test-token-not-real-XXXX';
const cipher = encryptToken(token, key, 'TELEGRAM_BOT_TOKEN');
assert(cipher.alg === 'aes-256-gcm' && Boolean(cipher.iv && cipher.tag && cipher.ct), 'cipher fields');
assert(!JSON.stringify(cipher).includes(token), 'ciphertext never contains plaintext');
assert(decryptToken(cipher, key, 'TELEGRAM_BOT_TOKEN') === token, 'round-trip with AAD');
let swapped = false;
try {
  decryptToken(cipher, key, 'BALE_BOT_TOKEN');
} catch {
  swapped = true;
}
assert(swapped, 'AAD mismatch fails closed');
const legacy = encryptToken(token, key);
assert(decryptToken(legacy, key, 'TELEGRAM_BOT_TOKEN') === token, 'legacy ciphertext still opens');

let bad = false;
try {
  decryptToken({ ...cipher, tag: cipher.iv }, key);
} catch {
  bad = true;
}
assert(bad, 'tampered tag fails closed');

assert(tokenFingerprint(token) === tokenFingerprint(token), 'fingerprint stable');
assert(tokenFingerprint(token) !== tokenFingerprint(`${token}x`), 'fingerprint changes');
assert(tokenFingerprint(token).length === 8, 'fingerprint is 8 hex chars');

assertTokenShape('TELEGRAM', token);
assertTokenShape('BALE', '987654321:bale-test-token-not-real');
assertTokenShape('RUBIKA', 'RUBIKA-test-token-not-real-ABCDEF');

function throws(fn: () => void, code: string) {
  try {
    fn();
    throw new Error(`expected ${code}`);
  } catch (err) {
    assert(err instanceof Error && err.message === code, `expected ${code}, got ${(err as Error).message}`);
  }
}
throws(() => assertTokenShape('TELEGRAM', 'short'), 'token_length');
throws(() => assertTokenShape('TELEGRAM', ` ${token}`), 'token_whitespace');
throws(() => assertTokenShape('TELEGRAM', 'not-a-telegram-token-value-xxxx'), 'token_shape');
throws(() => assertTokenShape('RUBIKA', 'has space in token-value-xxxx'), 'token_whitespace');

assert(providerFromSecretRef('BALE_BOT_TOKEN') === 'BALE', 'provider from ref');
assert(providerFromSecretRef('DATABASE_URL') === null, 'non-allowlisted ref');

applyVaultOverlay({});
assert(peekVaultToken('TELEGRAM_BOT_TOKEN') === null, 'empty overlay');
setVaultOverlayEntry('TELEGRAM_BOT_TOKEN', token);
assert(peekVaultToken('TELEGRAM_BOT_TOKEN') === token, 'overlay peek');
assert(resolveProviderToken('TELEGRAM', 'TELEGRAM_BOT_TOKEN') === token, 'resolve prefers vault over missing env');
assert(secretRefConfigured('TELEGRAM_BOT_TOKEN', {}) === true, 'readiness sees vault without env');

const prevEnv = process.env.TELEGRAM_BOT_TOKEN;
process.env.TELEGRAM_BOT_TOKEN = '111111:env-token-should-lose-to-vault';
assert(resolveProviderToken('TELEGRAM', 'TELEGRAM_BOT_TOKEN') === token, 'vault wins over env after admin save');
if (prevEnv === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
else process.env.TELEGRAM_BOT_TOKEN = prevEnv;

const status = publicSecretStatus('TELEGRAM_BOT_TOKEN', {});
assert(status.configured && status.source === 'vault' && Boolean(status.fingerprint), 'public status');
assert(!JSON.stringify(status).includes(token), 'status never serialises token');

const stored = parseStoredVault({
  v: 1,
  entries: {
    TELEGRAM_BOT_TOKEN: { ...cipher, fingerprint: tokenFingerprint(token), updatedAt: '2026-09-06T00:00:00.000Z' },
    DATABASE_URL: { ...cipher, fingerprint: 'x', updatedAt: null },
  },
});
assert(stored.entries.TELEGRAM_BOT_TOKEN && !stored.entries.DATABASE_URL, 'vault ignores non-provider keys');

try {
  assertNoVaultLeak({ secretRef: 'TELEGRAM_BOT_TOKEN', configured: true });
} catch {
  throw new Error('clean payload should pass');
}
let leak = false;
try {
  assertNoVaultLeak({ entries: { TELEGRAM_BOT_TOKEN: cipher } });
} catch {
  leak = true;
}
assert(leak, 'ciphertext fields refused in public payload');
let tokenKeyLeak = false;
try {
  assertNoVaultLeak({ token });
} catch {
  tokenKeyLeak = true;
}
assert(tokenKeyLeak, 'token field refused in public payload');
setVaultOverlayEntry('TELEGRAM_BOT_TOKEN', token);
let overlayLeak = false;
try {
  assertNoVaultLeak({ note: `saved ${token}` });
} catch {
  overlayLeak = true;
}
assert(overlayLeak, 'overlay plaintext refused in public payload');

setVaultOverlayEntry('TELEGRAM_BOT_TOKEN', null);
assert(peekVaultToken('TELEGRAM_BOT_TOKEN') === null, 'clear overlay');
if (prevJwt === undefined) delete process.env.JWT_SECRET;
else process.env.JWT_SECRET = prevJwt;
if (prevVaultKey === undefined) delete process.env.OMNICHANNEL_VAULT_KEY;
else process.env.OMNICHANNEL_VAULT_KEY = prevVaultKey;
if (prevNode === undefined) delete process.env.NODE_ENV;
else process.env.NODE_ENV = prevNode;
if (prevApp === undefined) delete process.env.APP_ENV;
else process.env.APP_ENV = prevApp;

console.log('omnichannel-token-vault.spec.ts: ok');
