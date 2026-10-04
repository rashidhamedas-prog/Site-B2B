import { attributeLinkProducts } from './sales-partner-attribution';
import {
  isUniqueViolation,
  mergedClickedProducts,
  missingSnapshotItemIds,
  paymentStartSwitch,
  payoutCarryAllowed,
  productMarginIrr,
  referralPaymentDecision,
  referralClickBurstAllowed,
  REFERRAL_SESSION_TTL_MS,
  signReferralSession,
  verifyReferralSession,
} from './sales-partner-referral-policy';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const secret = 'x'.repeat(40);
const now = Date.parse('2026-10-04T00:00:00Z');
const claims = {
  v: 1 as const,
  sid: '11111111-1111-4111-8111-111111111111',
  partnerId: '22222222-2222-4222-8222-222222222222',
  publicCode: 'ab23cd45',
  productIds: ['33333333-3333-4333-8333-333333333333'],
  exp: now + REFERRAL_SESSION_TTL_MS,
};

const token = signReferralSession(claims, secret);
assert(verifyReferralSession(token, secret, now)?.sid === claims.sid, 'signed session verifies');
assert(verifyReferralSession(token, secret, claims.exp) === null, 'expired session rejected');
assert(verifyReferralSession(`${token}x`, secret, now) === null, 'tampered token rejected');
assert(verifyReferralSession('ab23cd45', secret, now) === null, 'public code alone is not a session');
assert(REFERRAL_SESSION_TTL_MS === 14 * 24 * 60 * 60 * 1000, 'ttl stays 14 days');

const locked = referralPaymentDecision({
  sessionValid: true,
  requestedMethod: 'CASH',
  requestedGateway: 'DIGIPAY',
});
assert(locked.reject && locked.gateway === 'ZARINPAL', 'cash and other gateways rejected');
const unrelated = referralPaymentDecision({
  sessionValid: true,
  requestedMethod: 'ONLINE',
  requestedGateway: 'ZARINPAL',
});
assert(unrelated.exclusive && !unrelated.reject, 'whole session is zarinpal even without the clicked sku');
const open = referralPaymentDecision({
  sessionValid: false,
  requestedMethod: 'CASH',
  requestedGateway: 'DIGIPAY',
});
assert(!open.exclusive && open.method === 'CASH', 'orders without a session keep the requested method');

assert(
  paymentStartSwitch({ exclusiveZarinpal: true, requested: 'TOROBPAY', pendingGateway: null }).action === 'reject',
  'retry with another gateway is rejected',
);
assert(
  paymentStartSwitch({
    exclusiveZarinpal: true,
    requested: 'ZARINPAL',
    pendingGateway: 'DIGIPAY',
  }).action === 'block_inflight',
  'in-flight digipay is not moved',
);
assert(
  paymentStartSwitch({ exclusiveZarinpal: false, requested: 'ZARINPAL', pendingGateway: 'TOROBPAY' }).action
    === 'block_inflight',
  'pre-release torobpay is not cancelled',
);
assert(
  paymentStartSwitch({ exclusiveZarinpal: false, requested: 'DIGIPAY', pendingGateway: null }).action === 'proceed',
  'wholesale-style non-referral start still proceeds',
);

const self = attributeLinkProducts({
  partnerActive: true,
  selfReferral: true,
  requestedProductIds: claims.productIds,
  cartProductIds: claims.productIds,
  eligibleProductIds: claims.productIds,
});
assert(self.length === 0, 'self purchase earns nothing');
const inactive = attributeLinkProducts({
  partnerActive: false,
  selfReferral: false,
  requestedProductIds: claims.productIds,
  cartProductIds: claims.productIds,
  eligibleProductIds: claims.productIds,
});
assert(inactive.length === 0, 'partner deactivated after click earns nothing');
const otherCart = attributeLinkProducts({
  partnerActive: true,
  selfReferral: false,
  requestedProductIds: claims.productIds,
  cartProductIds: ['99999999-9999-4999-8999-999999999999'],
  eligibleProductIds: claims.productIds,
});
assert(otherCart.length === 0, 'unrelated cart line is not commissioned');

assert(
  mergedClickedProducts(claims.partnerId, claims.productIds, claims.partnerId, '44444444-4444-4444-8444-444444444444')
    .length === 2,
  'same partner merges clicks',
);
assert(
  mergedClickedProducts(claims.partnerId, claims.productIds, '55555555-5555-4555-8555-555555555555', '44444444-4444-4444-8444-444444444444')
    .length === 1,
  'last valid partner replaces the previous click list',
);

assert(missingSnapshotItemIds(['a'], ['a', 'b']).join() === 'b', 'partial snapshot does not skip the missing line');
assert(isUniqueViolation({ code: '23505' }) && !isUniqueViolation({ code: '23503' }), 'only unique violations are ignored');
assert(
  productMarginIrr({
    payableIrr: 80_000,
    discountIrr: 20_000,
    goodsCostIrr: 30_000,
    variableCostIrr: 10_000,
    partnerCommissionIrr: 8_000,
  }) === 32_000,
  'own-product margin includes discounted payable, costs, and commission',
);
assert(payoutCarryAllowed(-500).ok === false && payoutCarryAllowed(1000).ok === true, 'negative balance is not paid');
assert(referralClickBurstAllowed(39) && !referralClickBurstAllowed(40), 'click burst stops at the cap');

console.log('sales-partner-referral-policy.spec.ts: OK');
