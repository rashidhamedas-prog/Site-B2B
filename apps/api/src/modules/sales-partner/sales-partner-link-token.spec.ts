import {
  mergePriorProductIds,
  readPriorAttributionProductIds,
  signSalesPartnerAttributionToken,
  verifySalesPartnerAttributionToken,
} from './sales-partner-link-token';
import { resolveSalesPartnerAttrSecret } from './sales-partner-attr-secret';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const secret = 'test-sp-attr-secret';
const code = 'ab12cd34';
const p1 = '11111111-1111-4111-8111-111111111111';
const p2 = '22222222-2222-4222-8222-222222222222';
const now = new Date('2026-10-26T12:00:00.000Z');

const token = signSalesPartnerAttributionToken({ code, productIds: [p1, p2], secret, now });
assert(typeof token === 'string' && token.includes('.'), 'token shape');

const ok = verifySalesPartnerAttributionToken({
  token,
  code,
  productIds: [p1],
  secret,
  now,
});
assert(ok.ok === true && ok.ok && ok.productIds.includes(p1), 'valid token attributes');

const forged = verifySalesPartnerAttributionToken({
  token: undefined,
  code,
  productIds: [p1],
  secret,
  now,
});
assert(forged.ok === false && forged.reason === 'missing', 'forged code without token → no attribution');

const badSig = verifySalesPartnerAttributionToken({
  token: `${token.split('.')[0]}.deadbeef`,
  code,
  productIds: [p1],
  secret,
  now,
});
assert(badSig.ok === false && badSig.reason === 'invalid', 'tampered sig rejected');

const expired = signSalesPartnerAttributionToken({
  code,
  productIds: [p1],
  secret,
  now: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
  ttlMs: 1000,
});
const expiredCheck = verifySalesPartnerAttributionToken({
  token: expired,
  code,
  productIds: [p1],
  secret,
  now,
});
assert(expiredCheck.ok === false && expiredCheck.reason === 'expired', 'expired token → none');

const wrongCode = verifySalesPartnerAttributionToken({
  token,
  code: 'zzzzzzzz',
  productIds: [p1],
  secret,
  now,
});
assert(wrongCode.ok === false && wrongCode.reason === 'mismatch', 'code mismatch');

const merged = mergePriorProductIds([p1], p2);
assert(merged.length === 2 && merged.includes(p1) && merged.includes(p2), 'merge prior products');

const prior = readPriorAttributionProductIds({ token, code, secret, now });
assert(prior.includes(p1) && prior.includes(p2), 'prior from valid token');
assert(readPriorAttributionProductIds({ token, code: 'deadbeef', secret, now }).length === 0, 'prior wrong code');
assert(resolveSalesPartnerAttrSecret('dedicated', 'jwt') === 'dedicated', 'attr secret preferred');
assert(resolveSalesPartnerAttrSecret('', 'jwt') === 'jwt', 'attr secret falls back to jwt');

console.log('sales-partner-link-token.spec.ts: OK');
