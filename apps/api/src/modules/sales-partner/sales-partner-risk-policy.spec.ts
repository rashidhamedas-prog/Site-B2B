import { evaluateSalesPartnerRisk, humanRiskFlags, maxPhoneRepeats } from './sales-partner-risk-policy';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(evaluateSalesPartnerRisk({
  draftsLast24h: 14,
  decided: 4,
  converted: 0,
  expired: 4,
  rejected: 0,
  maxPhoneRepeats: 3,
}).length === 0, 'below thresholds stay quiet');

const noisy = evaluateSalesPartnerRisk({
  draftsLast24h: 15,
  decided: 10,
  converted: 1,
  expired: 6,
  rejected: 5,
  maxPhoneRepeats: 4,
});
assert(noisy.includes('HIGH_DRAFT_VOLUME'), 'volume');
assert(noisy.includes('HIGH_NO_CONFIRM'), 'confirm rate');
assert(noisy.includes('HIGH_EXPIRE'), 'expire');
assert(noisy.includes('HIGH_REJECT'), 'reject');
assert(noisy.includes('REPEAT_CUSTOMER'), 'repeat phone');
assert(!humanRiskFlags(noisy).some((label) => label.includes('0.3') || label.includes('threshold')), 'no formula leak');
assert(maxPhoneRepeats(['09151111111', '09151111111', '09152222222', null]) === 2, 'phone repeats');

console.log('sales-partner-risk-policy.spec.ts: OK');
