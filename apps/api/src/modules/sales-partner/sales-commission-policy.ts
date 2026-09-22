/** Integer IRR commission math. No float. No Vendor ledger types. */

export const COMMISSION_SCOPES = [
  'PROGRAM',
  'CATEGORY',
  'PRODUCT',
  'PARTNER_CATEGORY',
  'PARTNER_PRODUCT',
] as const;
export type CommissionScope = (typeof COMMISSION_SCOPES)[number];

export type CommissionRule = {
  id: string;
  scope: CommissionScope;
  percent: number;
  active: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  productId: string | null;
  categoryId: string | null;
  salesPartnerId: string | null;
  version: number;
};

export type LineForCommission = {
  productId: string;
  categoryId: string | null;
  lineTotalAfterDiscountIrr: number;
};

const SCOPE_RANK: Record<CommissionScope, number> = {
  PARTNER_PRODUCT: 1,
  PARTNER_CATEGORY: 2,
  PRODUCT: 3,
  CATEGORY: 4,
  PROGRAM: 5,
};

export function assertPercent(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 80) throw new Error('INVALID_PERCENT');
  return n;
}

export function commissionAmountIrr(eligibleNetIrr: number, percent: number): number {
  if (!Number.isInteger(eligibleNetIrr) || eligibleNetIrr < 0) throw new Error('INVALID_ELIGIBLE');
  const pct = assertPercent(percent);
  return Math.floor((eligibleNetIrr * pct) / 100);
}

export function ruleInForce(rule: CommissionRule, at: Date): boolean {
  if (!rule.active) return false;
  if (rule.startsAt && rule.startsAt.getTime() > at.getTime()) return false;
  if (rule.endsAt && rule.endsAt.getTime() <= at.getTime()) return false;
  return true;
}

export function ruleMatchesLine(
  rule: CommissionRule,
  line: LineForCommission,
  salesPartnerId: string,
): boolean {
  if (rule.salesPartnerId && rule.salesPartnerId !== salesPartnerId) return false;
  if (rule.productId && rule.productId !== line.productId) return false;
  if (rule.categoryId && rule.categoryId !== line.categoryId) return false;
  if (rule.scope === 'PARTNER_PRODUCT') {
    return rule.salesPartnerId === salesPartnerId && rule.productId === line.productId;
  }
  if (rule.scope === 'PARTNER_CATEGORY') {
    return rule.salesPartnerId === salesPartnerId && !!line.categoryId && rule.categoryId === line.categoryId;
  }
  if (rule.scope === 'PRODUCT') return rule.productId === line.productId && !rule.salesPartnerId;
  if (rule.scope === 'CATEGORY') {
    return !!line.categoryId && rule.categoryId === line.categoryId && !rule.salesPartnerId;
  }
  return rule.scope === 'PROGRAM';
}

export function selectCommissionRule(
  rules: CommissionRule[],
  line: LineForCommission,
  salesPartnerId: string,
  at: Date,
): CommissionRule | null {
  const matches = rules
    .filter((rule) => ruleInForce(rule, at) && ruleMatchesLine(rule, line, salesPartnerId))
    .sort((a, b) => SCOPE_RANK[a.scope] - SCOPE_RANK[b.scope]);
  return matches[0] ?? null;
}

/** Allocate an order-level discount across lines so the ریال sum is exact. */
export function allocateOrderDiscountIrr(
  lineTotalsIrr: number[],
  orderDiscountIrr: number,
): number[] {
  if (!Number.isInteger(orderDiscountIrr) || orderDiscountIrr < 0) throw new Error('INVALID_DISCOUNT');
  const merchandise = lineTotalsIrr.reduce((sum, n) => {
    if (!Number.isInteger(n) || n < 0) throw new Error('INVALID_LINE');
    return sum + n;
  }, 0);
  if (merchandise <= 0 || orderDiscountIrr === 0) return lineTotalsIrr.map(() => 0);
  const capped = Math.min(orderDiscountIrr, merchandise);
  const raw = lineTotalsIrr.map((n) => (n * capped) / merchandise);
  const floors = raw.map((n) => Math.floor(n));
  let remainder = capped - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac);
  for (const row of order) {
    if (remainder <= 0) break;
    floors[row.index] += 1;
    remainder -= 1;
  }
  return floors;
}

export function promoDiscountIrr(orderDiscountIrr: number, walletAppliedIrr: number): number {
  if (!Number.isInteger(orderDiscountIrr) || orderDiscountIrr < 0) throw new Error('INVALID_DISCOUNT');
  if (!Number.isInteger(walletAppliedIrr) || walletAppliedIrr < 0) throw new Error('INVALID_WALLET');
  return Math.max(0, orderDiscountIrr - walletAppliedIrr);
}

export function snapshotLineCommissions(input: {
  lines: { orderItemId: string; lineTotalIrr: number; percent: number }[];
  orderDiscountIrr: number;
  walletAppliedIrr: number;
}): { orderItemId: string; eligibleNetIrr: number; commissionIrr: number; percent: number }[] {
  const promo = promoDiscountIrr(input.orderDiscountIrr, input.walletAppliedIrr);
  const allocated = allocateOrderDiscountIrr(input.lines.map((line) => line.lineTotalIrr), promo);
  return input.lines.map((line, index) => {
    const eligibleNetIrr = Math.max(0, line.lineTotalIrr - allocated[index]);
    return {
      orderItemId: line.orderItemId,
      eligibleNetIrr,
      commissionIrr: commissionAmountIrr(eligibleNetIrr, line.percent),
      percent: line.percent,
    };
  });
}

export function remainingReversalIrr(earnedIrr: number, alreadyReversedAbsIrr: number): number {
  if (!Number.isInteger(earnedIrr) || earnedIrr < 0) throw new Error('INVALID_EARNED');
  if (!Number.isInteger(alreadyReversedAbsIrr) || alreadyReversedAbsIrr < 0) throw new Error('INVALID_REVERSED');
  return Math.max(0, earnedIrr - alreadyReversedAbsIrr);
}

export function isFullOrderReversalStatus(status: string): boolean {
  return status === 'CANCELLED' || status === 'DELETED' || status === 'REFUNDED' || status === 'RETURNED';
}

export function isApprovedReturnStatus(status: string): boolean {
  return status === 'APPROVED' || status === 'COMPLETED';
}

export function eligibleMerchandiseIrr(input: {
  lineTotalsAfterLineDiscountIrr: number[];
  orderDiscountIrr: number;
  shippingFeeIrr: number;
  walletAppliedIrr: number;
}): number {
  const allocated = allocateOrderDiscountIrr(input.lineTotalsAfterLineDiscountIrr, input.orderDiscountIrr);
  const goods = input.lineTotalsAfterLineDiscountIrr.reduce((sum, n, i) => sum + n - allocated[i], 0);
  if (input.shippingFeeIrr < 0 || !Number.isInteger(input.shippingFeeIrr)) throw new Error('INVALID_SHIPPING');
  if (input.walletAppliedIrr < 0 || !Number.isInteger(input.walletAppliedIrr)) throw new Error('INVALID_WALLET');
  return Math.max(0, goods);
}

export function vendorSkuMarginIrr(input: {
  retailNetIrr: number;
  vendorDueIrr: number;
  partnerPercent: number;
}): number {
  if (!Number.isInteger(input.retailNetIrr) || !Number.isInteger(input.vendorDueIrr)) {
    throw new Error('INVALID_MARGIN_INPUT');
  }
  const partnerDue = commissionAmountIrr(input.retailNetIrr, input.partnerPercent);
  return input.retailNetIrr - input.vendorDueIrr - partnerDue;
}

export function vendorDueFromRetailIrr(retailNetIrr: number, taranomVendorCommissionPercent: number | null): number {
  const net = Number.isInteger(retailNetIrr) ? retailNetIrr : 0;
  const cutPct = Number.isInteger(taranomVendorCommissionPercent) ? Number(taranomVendorCommissionPercent) : 0;
  const cut = Math.floor((net * cutPct) / 100);
  return Math.max(0, net - cut);
}

export function assertCommissionRuleShape(input: {
  scope: string;
  productId?: string | null;
  categoryId?: string | null;
  salesPartnerId?: string | null;
}): CommissionScope {
  if (!(COMMISSION_SCOPES as readonly string[]).includes(input.scope)) {
    throw new Error('INVALID_SCOPE');
  }
  const scope = input.scope as CommissionScope;
  if ((scope === 'PRODUCT' || scope === 'PARTNER_PRODUCT') && !input.productId) {
    throw new Error('PRODUCT_REQUIRED');
  }
  if ((scope === 'CATEGORY' || scope === 'PARTNER_CATEGORY') && !input.categoryId) {
    throw new Error('CATEGORY_REQUIRED');
  }
  if ((scope === 'PARTNER_PRODUCT' || scope === 'PARTNER_CATEGORY') && !input.salesPartnerId) {
    throw new Error('PARTNER_REQUIRED');
  }
  if (scope === 'PROGRAM' && (input.productId || input.categoryId || input.salesPartnerId)) {
    throw new Error('PROGRAM_MUST_BE_GLOBAL');
  }
  return scope;
}
