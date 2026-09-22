import {
  allocateOrderDiscountIrr,
  assertCommissionRuleShape,
  commissionAmountIrr,
  eligibleMerchandiseIrr,
  selectCommissionRule,
  vendorDueFromRetailIrr,
  vendorSkuMarginIrr,
  type CommissionRule,
} from './sales-commission-policy';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(commissionAmountIrr(100_000, 10) === 10_000, '10 percent');
assert(commissionAmountIrr(101, 10) === 10, 'floor');
try {
  commissionAmountIrr(100, 12.5);
  throw new Error('float percent should fail');
} catch (err) {
  assert(err instanceof Error && err.message === 'INVALID_PERCENT', 'no float percent');
}

const at = new Date('2026-09-22T10:00:00.000Z');
const rules: CommissionRule[] = [
  { id: 'prog', scope: 'PROGRAM', percent: 5, active: true, startsAt: null, endsAt: null, productId: null, categoryId: null, salesPartnerId: null, version: 1 },
  { id: 'cat', scope: 'CATEGORY', percent: 8, active: true, startsAt: null, endsAt: null, productId: null, categoryId: 'coats', salesPartnerId: null, version: 1 },
  { id: 'prod', scope: 'PRODUCT', percent: 12, active: true, startsAt: null, endsAt: null, productId: 'p1', categoryId: null, salesPartnerId: null, version: 1 },
  { id: 'pp', scope: 'PARTNER_PRODUCT', percent: 15, active: true, startsAt: null, endsAt: null, productId: 'p1', categoryId: null, salesPartnerId: 'sp1', version: 1 },
];
assert(selectCommissionRule(rules, { productId: 'p1', categoryId: 'coats', lineTotalAfterDiscountIrr: 1 }, 'sp1', at)?.id === 'pp', 'partner product wins');
assert(selectCommissionRule(rules, { productId: 'p1', categoryId: 'coats', lineTotalAfterDiscountIrr: 1 }, 'sp2', at)?.id === 'prod', 'product next');
assert(selectCommissionRule(rules, { productId: 'p2', categoryId: 'coats', lineTotalAfterDiscountIrr: 1 }, 'sp1', at)?.id === 'cat', 'category');
assert(selectCommissionRule(rules, { productId: 'p2', categoryId: 'other', lineTotalAfterDiscountIrr: 1 }, 'sp1', at)?.id === 'prog', 'program');
const expired: CommissionRule = { ...rules[2], id: 'old', endsAt: new Date('2026-01-01T00:00:00.000Z') };
assert(selectCommissionRule([expired, rules[0]], { productId: 'p1', categoryId: null, lineTotalAfterDiscountIrr: 1 }, 'sp1', at)?.id === 'prog', 'expired skipped');

const allocated = allocateOrderDiscountIrr([100, 100, 100], 10);
assert(allocated.reduce((a, b) => a + b, 0) === 10, 'discount remainder');
assert(eligibleMerchandiseIrr({
  lineTotalsAfterLineDiscountIrr: [100_000, 50_000],
  orderDiscountIrr: 10_000,
  shippingFeeIrr: 40_000,
  walletAppliedIrr: 20_000,
}) === 140_000, 'shipping and wallet excluded');
assert(vendorSkuMarginIrr({ retailNetIrr: 1_000_000, vendorDueIrr: 800_000, partnerPercent: 10 }) === 100_000, 'margin ok');
assert(vendorSkuMarginIrr({ retailNetIrr: 1_000_000, vendorDueIrr: 950_000, partnerPercent: 10 }) === -50_000, 'margin negative');

assert(vendorDueFromRetailIrr(1_000_000, 20) === 800_000, 'vendor due after taranom cut');
assert(assertCommissionRuleShape({ scope: 'PROGRAM' }) === 'PROGRAM', 'program scope');
try {
  assertCommissionRuleShape({ scope: 'PRODUCT' });
  throw new Error('product without id should fail');
} catch (err) {
  assert(err instanceof Error && err.message === 'PRODUCT_REQUIRED', 'product required');
}

console.log('sales-commission-policy.spec.ts: OK');
