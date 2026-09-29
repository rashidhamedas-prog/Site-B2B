/**
 * npx ts-node --transpile-only src/modules/customer-marketing/zero-order-scoring.spec.ts
 */
import {
  agingBucket,
  isAgingBucket,
  isZeroOrderEligible,
  zeroOrderPriority,
} from './zero-order-scoring';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(agingBucket(0) === 'fresh' && agingBucket(2) === 'fresh', 'fresh');
assert(agingBucket(3) === 'warm' && agingBucket(7) === 'warm', 'warm');
assert(agingBucket(8) === 'aging' && agingBucket(30) === 'aging', 'aging');
assert(agingBucket(31) === 'cool' && agingBucket(90) === 'cool', 'cool');
assert(agingBucket(91) === 'recycle', 'recycle');
assert(isAgingBucket('fresh') && !isAgingBucket('hot'), 'bucket guard');

assert(isZeroOrderEligible({
  channel: 'RETAIL', customerStatus: 'ACTIVE', settledOrderCount: 0,
}), 'retail zero');
assert(!isZeroOrderEligible({
  channel: 'RETAIL', customerStatus: 'ACTIVE', settledOrderCount: 1,
}), 'retail bought out');
assert(isZeroOrderEligible({
  channel: 'WHOLESALE', customerStatus: 'PENDING', settledOrderCount: 0,
}), 'ws pending');
assert(isZeroOrderEligible({
  channel: 'WHOLESALE', customerStatus: 'ACTIVE', settledOrderCount: 0,
}), 'ws approved zero');
assert(!isZeroOrderEligible({
  channel: 'WHOLESALE', customerStatus: 'INACTIVE', settledOrderCount: 0,
}), 'ws inactive out');
assert(!isZeroOrderEligible({
  channel: 'RETAIL', customerStatus: 'ACTIVE', settledOrderCount: 0, deleted: true,
}), 'deleted out');

const hot = zeroOrderPriority({
  daysSinceRegister: 1,
  channel: 'WHOLESALE',
  customerStatus: 'PENDING',
  hasCheckoutIntent: true,
  lastCallResult: 'CALLBACK',
});
const cold = zeroOrderPriority({
  daysSinceRegister: 120,
  channel: 'RETAIL',
  customerStatus: 'ACTIVE',
  hasCheckoutIntent: false,
  daysSinceLastCall: 2,
});
assert(hot > cold, 'hot beats cold');
assert(hot <= 100 && cold >= 0, 'bounds');

const mid = zeroOrderPriority({
  daysSinceRegister: 5,
  channel: 'RETAIL',
  customerStatus: 'ACTIVE',
  hasCheckoutIntent: false,
  daysSinceLastCall: null,
});
assert(mid >= 40 && mid <= 90, 'warm retail mid');

console.log('zero-order-scoring.spec.ts: ok');
