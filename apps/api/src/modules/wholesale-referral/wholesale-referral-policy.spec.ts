import {
  DEFAULT_WHOLESALE_REFERRAL_SETTINGS,
  applyOwnershipOverride,
  assertPayoutAllowed,
  bucketTotals,
  canAdjustReward,
  canOpenDispute,
  canOverrideOwnership,
  canReviewReferral,
  commitOwnership,
  missingLaunchFields,
  planEstimate,
  planHoldRelease,
  planRefundReversal,
  programAllowsApply,
  programCanLockOwnership,
  qualifyingNetMerchandise,
  readReferralCookie,
  resolveWholesaleReferralSettings,
  rewardAmount,
  toPartnerIntroduction,
  validateManualIntroduction,
  validateStatusChange,
  type IntroRecord,
  type LedgerRow,
  type QualifyingOrder,
  type RewardRule,
  type WholesaleReferralSettings,
} from './wholesale-referral-policy';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const NOW = '2026-10-04T12:00:00.000Z';
const PHONE_A = '09120000001';
const PHONE_B = '09120000002';
const BOUTIQUE = '09120000003';

function readySettings(overrides: Partial<WholesaleReferralSettings> = {}): WholesaleReferralSettings {
  return {
    ...DEFAULT_WHOLESALE_REFERRAL_SETTINGS,
    enabled: true,
    mode: 'LIVE',
    applyOpen: true,
    termsVersion: '2026-10-owner-v1',
    termsBody: 'شرایط تأییدشده',
    rewardKind: 'RATE_BPS',
    rewardRateBps: 1000,
    rewardFixedAmount: null,
    rewardCap: 5_000_000,
    ownershipWindowDays: 90,
    holdDays: 14,
    minPayout: 0,
    payoutSchedule: 'پس از تأیید مالی',
    salesResponseTargetHours: 48,
    boutiqueEligibilityNote: 'بوتیک پوشاک فعال',
    ...overrides,
    repeatOrderRewards: false,
    marketDevelopmentTier: false,
  };
}

assert(missingLaunchFields(DEFAULT_WHOLESALE_REFERRAL_SETTINGS).length > 0, 'defaults are incomplete');
assert(programAllowsApply(DEFAULT_WHOLESALE_REFERRAL_SETTINGS, PHONE_A) === false, 'apply stays closed');
assert(programCanLockOwnership(DEFAULT_WHOLESALE_REFERRAL_SETTINGS, PHONE_A) === false, 'no lock before policy');

const forced = resolveWholesaleReferralSettings({
  ...readySettings(),
  repeatOrderRewards: true,
  marketDevelopmentTier: true,
  rewardRateBps: '1000',
});
assert(forced.repeatOrderRewards === false, 'repeat orders stay off');
assert(forced.marketDevelopmentTier === false, 'advanced tier stays off');
assert(forced.rewardRateBps === 1000, 'numeric reward parses');
assert(programAllowsApply(readySettings(), PHONE_A) === true, 'live apply opens when complete');
assert(programAllowsApply(readySettings({ mode: 'CANARY', pilotPhones: [PHONE_A] }), PHONE_B) === false, 'canary blocks others');
assert(programAllowsApply(readySettings({ mode: 'CANARY', pilotPhones: [PHONE_A] }), PHONE_A) === true, 'canary allows pilot');
assert(programAllowsApply(readySettings({ ownershipWindowDays: null }), PHONE_A) === false, 'unset window blocks launch');

function attempt(partial: Partial<Parameters<typeof commitOwnership>[1]> = {}) {
  return {
    newId: 'new-1',
    partnerId: 'p1',
    partnerPhone: PHONE_A,
    boutiquePhone: BOUTIQUE,
    customerId: 'c1',
    customerPreexistingActive: false,
    referralCodeValid: true,
    now: NOW,
    windowDays: 90,
    programCanLock: true,
    ...partial,
  };
}

const first = commitOwnership([], attempt());
assert(first.decision === 'LOCKED', 'first valid locks');
assert(first.records.filter((row) => row.ownershipStatus === 'OWNED').length === 1, 'one owner');
const owned = first.records[0];
assert(owned.expiresAt === '2027-01-02T12:00:00.000Z', 'window is 90 utc days');

const again = commitOwnership(first.records, attempt({ newId: 'new-2', customerId: 'c1' }));
assert(again.decision === 'IDEMPOTENT', 'same partner does not duplicate');
assert(again.records.filter((row) => row.ownershipStatus === 'OWNED').length === 1, 'still one owner');

const rival = commitOwnership(first.records, attempt({ newId: 'new-3', partnerId: 'p2', partnerPhone: PHONE_B }));
assert(rival.decision === 'CONFLICT', 'second partner conflicts');
assert(rival.records.find((row) => row.id === owned.id)?.ownershipStatus === 'OWNED', 'valid owner stays');
assert(rival.records.find((row) => row.id === 'new-3')?.ownershipStatus === 'CONFLICT', 'rival is not owner');

const self = commitOwnership([], attempt({ partnerPhone: BOUTIQUE, boutiquePhone: BOUTIQUE }));
assert(self.decision === 'REJECTED' && self.reasonCode === 'SELF_REFERRAL', 'self referral rejected');
assert(self.records.every((row) => row.ownershipStatus !== 'OWNED'), 'self does not own');

const existing = commitOwnership([], attempt({ customerPreexistingActive: true }));
assert(existing.decision === 'CONFLICT' && existing.reasonCode === 'PREEXISTING_CUSTOMER', 'existing customer conflicts');
assert(existing.records.every((row) => row.ownershipStatus !== 'OWNED'), 'existing customer is not owned');

const pending = commitOwnership([], attempt({ programCanLock: false, windowDays: null, customerId: null }));
assert(pending.decision === 'RECORDED_PENDING', 'unset window records without a lock');
assert(pending.records[0].ownershipStatus === 'AWAITING_POLICY', 'awaiting policy');

const expiredOwned: IntroRecord = {
  ...owned,
  expiresAt: '2026-10-01T00:00:00.000Z',
};
const afterExpiry = commitOwnership([expiredOwned], attempt({ newId: 'new-4', partnerId: 'p2', partnerPhone: PHONE_B }));
assert(afterExpiry.decision === 'LOCKED', 'expired ownership can be replaced');
assert(afterExpiry.records.find((row) => row.id === owned.id)?.ownershipStatus === 'EXPIRED', 'old row expires');
assert(afterExpiry.records.find((row) => row.id === 'new-4')?.ownershipStatus === 'OWNED', 'new owner locks');
assert(afterExpiry.records.find((row) => row.id === owned.id)?.partnerId === 'p1', 'history kept');

const direct = commitOwnership(pending.records, attempt({ newId: 'new-5', customerId: 'c9' }));
assert(direct.decision === 'LOCKED', 'direct registration locks the recorded introduction');
assert(direct.records.find((row) => row.partnerId === 'p1')?.customerId === 'c9', 'customer binds to first introduction');

assert(validateManualIntroduction(false).ok === false, 'manual intro needs consent');
assert(validateManualIntroduction(true).ok === true, 'recorded consent allows manual intro');

assert(validateStatusChange({ toStatus: 'REJECTED' }).ok === false, 'rejection needs a reason');
const held = validateStatusChange({
  toStatus: 'REWARD_HELD',
  reasonCode: 'NO_RESPONSE',
  internalNote: 'تماس داخلی',
  partnerExplanation: '',
});
assert(held.ok === true && held.ok && held.partnerExplanation.includes('پاسخی'), 'partner text from reason');
assert(held.ok === true && held.internalNote === 'تماس داخلی', 'internal note stored separately');
assert(validateStatusChange({ toStatus: 'NOT_A_STAGE', reasonCode: 'OTHER' }).ok === false, 'unknown stage rejected');

const baseOrder: QualifyingOrder = {
  orderType: 'WHOLESALE',
  subtotal: 1_000_000,
  discount: 100_000,
  walletApplied: 40_000,
  shippingFee: 80_000,
  taxAmount: 90_000,
  cancelled: false,
  paymentStatus: 'NONE',
  paidAmount: 0,
  refundedAmount: 0,
  returnedMerchandise: 0,
};
const unpaid = qualifyingNetMerchandise(baseOrder);
assert(unpaid.qualified === false && unpaid.reason === 'ORDER_NOT_PAID', 'create alone does not qualify');
assert(unpaid.shippingExcluded && unpaid.taxExcluded, 'shipping and tax stay out');

const paid = qualifyingNetMerchandise({
  ...baseOrder,
  paymentStatus: 'PAID',
  paidAmount: 1_200_000,
});
assert(paid.qualified && paid.netMerchandise === 940_000, 'promo excludes wallet; shipping and tax excluded');

const partialPay = qualifyingNetMerchandise({
  ...baseOrder,
  paymentStatus: 'PAID',
  paidAmount: 500_000,
});
assert(partialPay.netMerchandise === 500_000, 'merchandise is recognized up to the captured payment');

const returned = qualifyingNetMerchandise({
  ...baseOrder,
  paymentStatus: 'PAID',
  paidAmount: 1_200_000,
  returnedMerchandise: 200_000,
  refundedAmount: 100_000,
});
assert(returned.netMerchandise === 640_000, 'return and refund reduce net');
assert(qualifyingNetMerchandise({ ...baseOrder, orderType: 'RETAIL_WEBSITE', paymentStatus: 'PAID', paidAmount: 10 }).qualified === false, 'retail excluded');

const fixtureRule: RewardRule = { version: 'test-fixture', kind: 'RATE_BPS', rateBps: 1000, fixedAmount: null, cap: 50_000 };
assert(rewardAmount(940_000, fixtureRule) === 50_000, 'cap applies to fixture rate');
assert(rewardAmount(940_000, null) === null, 'unset rule has no amount');

const estimate = planEstimate({
  existingKeys: new Set(),
  introductionId: 'i1',
  orderId: 'o1',
  order: { ...baseOrder, paymentStatus: 'PAID', paidAmount: 1_200_000 },
  rule: fixtureRule,
});
assert(estimate.rows.length === 1 && estimate.rows[0].bucket === 'estimated', 'paid order estimates');
assert(estimate.rows[0].amount === 50_000, 'estimated amount uses snapshot rule');
const replay = planEstimate({
  existingKeys: new Set(estimate.rows.map((row) => row.idempotencyKey)),
  introductionId: 'i1',
  orderId: 'o1',
  order: { ...baseOrder, paymentStatus: 'PAID', paidAmount: 1_200_000 },
  rule: fixtureRule,
});
assert(replay.rows.length === 0, 'estimate is idempotent');
const createdOnly = planEstimate({
  existingKeys: new Set(),
  introductionId: 'i1',
  orderId: 'o1',
  order: baseOrder,
  rule: fixtureRule,
});
assert(createdOnly.blocked === 'ORDER_NOT_PAID' && createdOnly.rows.length === 0, 'unpaid order posts nothing');

const heldRows = planHoldRelease({
  existing: estimate.rows,
  existingKeys: new Set(estimate.rows.map((row) => row.idempotencyKey)),
  introductionId: 'i1',
  orderId: 'o1',
  to: 'held',
  ruleVersion: 'test-fixture',
});
assert(heldRows.length === 2, 'hold is a reversal pair');
assert(bucketTotals([...estimate.rows, ...heldRows]).estimated === 0, 'estimate moves');
assert(bucketTotals([...estimate.rows, ...heldRows]).held === 50_000, 'held receives the amount');
const heldReplay = planHoldRelease({
  existing: [...estimate.rows, ...heldRows],
  existingKeys: new Set([...estimate.rows, ...heldRows].map((row) => row.idempotencyKey)),
  introductionId: 'i1',
  orderId: 'o1',
  to: 'held',
  ruleVersion: 'test-fixture',
});
assert(heldReplay.length === 0, 'hold replay is a no-op');

const half = planRefundReversal({
  existing: estimate.rows,
  existingKeys: new Set(estimate.rows.map((row) => row.idempotencyKey)),
  introductionId: 'i1',
  orderId: 'o1',
  previousNet: 940_000,
  nextNet: 470_000,
  eventId: 'refund-1',
  ruleVersion: 'test-fixture',
});
assert(bucketTotals([...estimate.rows, ...half]).reversed === 25_000, 'half net reverses half of the open reward');
assert(bucketTotals([...estimate.rows, ...half]).estimated === 25_000, 'remainder stays estimated');
const halfReplay = planRefundReversal({
  existing: [...estimate.rows, ...half],
  existingKeys: new Set([...estimate.rows, ...half].map((row: LedgerRow) => row.idempotencyKey)),
  introductionId: 'i1',
  orderId: 'o1',
  previousNet: 940_000,
  nextNet: 470_000,
  eventId: 'refund-1',
  ruleVersion: 'test-fixture',
});
assert(halfReplay.length === 0, 'refund reversal is idempotent');

const view = toPartnerIntroduction({
  viewerPartnerId: 'p1',
  rewards: bucketTotals(estimate.rows),
  row: {
    id: 'i1',
    partnerId: 'p1',
    stage: 'REWARD_ESTIMATED',
    partnerExplanation: 'سفارش پرداخت شد و پاداش فقط برآورد است.',
    reasonCode: null,
    nextAction: 'منتظر دورهٔ نگهداری بمانید.',
    updatedAt: NOW,
    phone: BOUTIQUE,
    internalNote: 'یادداشت فروش',
    orderTotal: 1_200_000,
    lineItems: [{ sku: 'secret' }],
  },
});
assert(view.ok === true, 'owner can read');
if (view.ok) {
  const serialized = JSON.stringify(view.view);
  assert(!serialized.includes(BOUTIQUE), 'phone hidden');
  assert(!serialized.includes('یادداشت فروش'), 'internal note hidden');
  assert(!serialized.includes('1200000') && !serialized.includes('secret'), 'order price and items hidden');
  assert(view.view.freshness === 'manual', 'progress is not realtime');
  assert(view.view.rewards.estimated === 50_000, 'reward amount remains visible');
}
const denied = toPartnerIntroduction({
  viewerPartnerId: 'p2',
  rewards: bucketTotals([]),
  row: {
    id: 'i1',
    partnerId: 'p1',
    stage: 'SUBMITTED',
    partnerExplanation: null,
    reasonCode: null,
    nextAction: null,
    updatedAt: NOW,
    phone: BOUTIQUE,
  },
});
assert(denied.ok === false, 'other partner is denied');
assert(canOpenDispute('p2', 'p1') === false, 'dispute is owner-only');
assert(canOpenDispute('p1', 'p1') === true, 'owner can dispute');
assert(canReviewReferral('SALES_REP') === true, 'sales can review');
assert(canReviewReferral('ACCOUNTANT') === false, 'accountant is not the sales queue');
assert(canAdjustReward('ACCOUNTANT') === true && canAdjustReward('SALES_REP') === false, 'finance adjusts rewards');
assert(canOverrideOwnership('SALES_MANAGER') && !canOverrideOwnership('SALES_REP'), 'override is limited');
assert(assertPayoutAllowed(10, null).ok === false, 'unset minimum blocks payout');
const overrideDenied = applyOwnershipOverride({
  records: first.records,
  phone: BOUTIQUE,
  nextPartnerId: 'p2',
  now: NOW,
  windowDays: null,
  reason: 'بررسی انسانی تعارض',
});
assert(overrideDenied.ok === false, 'override waits for an approved window');
const rivalRow = rival.records.find((row) => row.partnerId === 'p2');
assert(!!rivalRow, 'rival row exists');
const override = applyOwnershipOverride({
  records: rival.records,
  phone: BOUTIQUE,
  nextPartnerId: 'p2',
  now: NOW,
  windowDays: 90,
  reason: 'بررسی انسانی تعارض',
});
assert(override.ok === true, 'explicit override can move ownership');
if (override.ok) {
  assert(override.records.find((row) => row.partnerId === 'p1')?.ownershipStatus === 'CONFLICT', 'previous owner is not deleted');
  assert(override.records.find((row) => row.partnerId === 'p2')?.ownershipStatus === 'OWNED', 'reviewed partner becomes owner');
}

assert(readReferralCookie('a=1; wr_code=Abcd1234') === 'abcd1234', 'cookie code normalized');
assert(readReferralCookie('wr_code=short') === null, 'bad code dropped');

console.log('wholesale-referral-policy.spec.ts: OK');
