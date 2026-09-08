/**
 * npx ts-node --transpile-only src/modules/customer-marketing/checkout-intent-policy.spec.ts
 */
import { shouldQueueAbandonedCheckout } from './checkout-intent-policy';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const base = {
  hasOpenIntent: true,
  intentAgeMinutes: 45,
  minAgeMinutes: 30,
  hasSettledOrderSinceIntent: false,
  recentPaymentFailed: false,
  alreadyQueued: false,
};

assert(shouldQueueAbandonedCheckout(base) === true, 'open intent after delay');
assert(shouldQueueAbandonedCheckout({ ...base, hasOpenIntent: false }) === false, 'no intent');
assert(shouldQueueAbandonedCheckout({ ...base, intentAgeMinutes: 10 }) === false, 'too soon');
assert(shouldQueueAbandonedCheckout({ ...base, hasSettledOrderSinceIntent: true }) === false, 'order completed');
assert(shouldQueueAbandonedCheckout({ ...base, recentPaymentFailed: true }) === false, 'skip after pay fail');
assert(shouldQueueAbandonedCheckout({ ...base, alreadyQueued: true }) === false, 'idempotent');

console.log('checkout-intent-policy.spec.ts: ok');
