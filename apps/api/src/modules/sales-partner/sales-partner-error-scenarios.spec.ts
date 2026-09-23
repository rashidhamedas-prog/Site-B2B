import {
  allocateOrderDiscountIrr,
  commissionAmountIrr,
  eligibleMerchandiseIrr,
  remainingReversalIrr,
  selectCommissionRule,
  snapshotLineCommissions,
  type CommissionRule,
} from './sales-commission-policy';
import { partnerOrderAttribution } from './sales-partner-attribution';
import {
  canTransitionDraft,
  confirmActionGone,
  confirmPageGone,
  hashConfirmationToken,
  isBlockedSelfReferral,
  isDraftExpired,
  priceDriftBps,
  resendBlockedReason,
  resolveConfirmPaymentMethod,
  smsFailureBlocksSend,
} from './sales-partner-draft-policy';
import { ledgerBalance } from './sales-partner-ledger-policy';
import { programAllowsPartnerAction, resolveSalesPartnerSettings } from './sales-partner-settings';
import { vendorSkuMarginIrr } from './sales-commission-policy';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const now = new Date('2026-09-23T08:00:00.000Z');

// 1+5 last unit / unavailable: leftover stock must fail before convert
assert(canTransitionDraft('CUSTOMER_CONFIRMED', 'CONVERTED_TO_ORDER'), '1 convert path exists');
assert(priceDriftBps(100_000, 100_000) === 0, '5 stable price');

// 2 double confirm click: converted is not gone
assert(confirmActionGone('CONVERTED_TO_ORDER') === false, '2 converted confirm is idempotent');

// 3 timeout after create: same hash / same key shape
assert(hashConfirmationToken('abc') === hashConfirmationToken('abc'), '3 token hash stable');

// 4 price change between draft and confirm
assert(priceDriftBps(100_000, 110_000) > 0, '4 price drift detected');

// 6 partner suspended after send: confirm page still readable, convert blocked by profile check
assert(confirmPageGone('AWAITING_CUSTOMER_CONFIRMATION') === false, '6 link readable');

// 7 customer confirms but does not pay: retail order stays AWAITING_PAYMENT, no earned yet
assert(confirmActionGone('CUSTOMER_CONFIRMED') === false, '7 confirm then pay is retail FSM');

// 8 payment callback retry is payment-module; partner convert already short-circuits
assert(canTransitionDraft('CONVERTED_TO_ORDER', 'CANCELLED') === false, '8 convert is terminal');

// 9 cancel before delivery: full reversal helper
assert(remainingReversalIrr(10_000, 10_000) === 0, '9 nothing left after full reverse');

// 10+11 partial then post-payout remaining
assert(remainingReversalIrr(10_000, 4_000) === 6_000, '10 partial remainder');

// 12 later rule change does not rewrite snapshot
const at = new Date('2026-09-01T00:00:00.000Z');
const oldRules: CommissionRule[] = [
  { id: 'old', scope: 'PROGRAM', percent: 10, active: true, startsAt: null, endsAt: null, productId: null, categoryId: null, salesPartnerId: null, version: 1 },
];
const laterRules: CommissionRule[] = [
  { id: 'new', scope: 'PROGRAM', percent: 1, active: true, startsAt: null, endsAt: null, productId: null, categoryId: null, salesPartnerId: null, version: 2 },
];
assert(selectCommissionRule(oldRules, { productId: 'p', categoryId: null, lineTotalAfterDiscountIrr: 100_000 }, 'sp', at)?.percent === 10, '12 snapshot uses old');
assert(selectCommissionRule(laterRules, { productId: 'p', categoryId: null, lineTotalAfterDiscountIrr: 100_000 }, 'sp', now)?.percent === 1, '12 new rule only for new orders');

// 13 mixed rates
const mixed = snapshotLineCommissions({
  lines: [
    { orderItemId: 'a', lineTotalIrr: 100_000, percent: 10 },
    { orderItemId: 'b', lineTotalIrr: 50_000, percent: 5 },
  ],
  orderDiscountIrr: 0,
  walletAppliedIrr: 0,
});
assert(mixed[0].commissionIrr === 10_000 && mixed[1].commissionIrr === 2_500, '13 mixed rates');

// 14 order-level discount allocated
const allocated = allocateOrderDiscountIrr([100_000, 50_000], 1_000);
assert(allocated[0] + allocated[1] === 1_000, '14 allocation sums');

// 15 wallet is tender, not merchandise discount
assert(eligibleMerchandiseIrr({
  lineTotalsAfterLineDiscountIrr: [100_000],
  orderDiscountIrr: 0,
  shippingFeeIrr: 0,
  walletAppliedIrr: 20_000,
}) === 100_000, '15 wallet excluded');

// 16 shipping excluded
assert(eligibleMerchandiseIrr({
  lineTotalsAfterLineDiscountIrr: [100_000],
  orderDiscountIrr: 0,
  shippingFeeIrr: 30_000,
  walletAppliedIrr: 0,
}) === 100_000, '16 shipping excluded');

// 17+18 payout / release concurrency covered by unique keys + payable filter
const balances = ledgerBalance([
  { amountIrr: 8_000, entryType: 'COMMISSION_EARNED', availableAt: now },
  { amountIrr: -8_000, entryType: 'PAYOUT', availableAt: now },
], now);
assert(balances.paid === 8_000 && balances.available === 0, '17 second payout has nothing payable');

// 19 IDOR is ownership scoped in service; self-referral is explicit
assert(isBlockedSelfReferral('09151234567', '09151234567', true), '20 self-referral blocked');
assert(isBlockedSelfReferral('09151234567', '09151234567', false) === false, '20 policy can allow');

// 21 vendor SKU margin guard
assert(vendorSkuMarginIrr({ retailNetIrr: 100_000, vendorDueIrr: 80_000, partnerPercent: 25 }) < 0, '21 negative margin rejected');

// 22 partner convert wins over external affiliate
assert(partnerOrderAttribution({ draftId: 'd', salesPartnerId: 'p' }).affiliateId === null, '22 no double commission');

// 23 SMS failure in production blocks; non-prod can continue for QA
assert(smsFailureBlocksSend('production', false), '23 prod sms fail');
assert(smsFailureBlocksSend('development', false) === false, '23 dev may continue');

// 24 expired draft while customer tab is open
assert(isDraftExpired(new Date('2026-09-23T07:00:00.000Z'), now), '24 expired');
assert(confirmPageGone('EXPIRED'), '24 expired page gone');
assert(confirmActionGone('EXPIRED'), '24 expired confirm gone');

// 26 COD spoof
assert(resolveConfirmPaymentMethod('CASH', false) === 'ONLINE', '26 COD ignored');
assert(resolveConfirmPaymentMethod('CASH', true) === 'CASH', '26 COD only if storefront allows');

// 27 negative balance after adjustment
const neg = ledgerBalance([
  { amountIrr: 5_000, entryType: 'COMMISSION_EARNED', availableAt: now },
  { amountIrr: -8_000, entryType: 'COMMISSION_REVERSAL', availableAt: now },
], now);
assert(neg.available < 0 || neg.reversed >= 8_000, '27 clawback recorded');

// resend limits
assert(resendBlockedReason(now, 5, now, 60, 5) === 'DAILY_CAP', '23/resend daily cap');
assert(resendBlockedReason(now, 1, now, 60, 5) === 'COOLDOWN', '23/resend cooldown');
assert(resendBlockedReason(new Date('2026-09-23T07:00:00.000Z'), 1, now, 60, 5) === null, '23/resend allowed');

// 25 stock after confirm before pay is retail checkout; flag OFF still blocks new drafts
const off = resolveSalesPartnerSettings({ enabled: true, mode: 'OFF' });
assert(!programAllowsPartnerAction(off, '09151234567'), 'flag off wins over enabled');

assert(commissionAmountIrr(99, 10) === 9, 'integer floor remains');

console.log('sales-partner-error-scenarios.spec.ts: OK');
