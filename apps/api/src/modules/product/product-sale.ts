/**
 * Dual-channel sale resolution.
 * Transaction prices remain wholesalePrice / retailPrice (final / after-discount).
 * compare-at columns are the original/base prices when a sale is configured.
 */

export type DiscountType = 'PERCENT' | 'FIXED';
export type SalesChannel = 'RETAIL' | 'WHOLESALE';

export interface ProductSaleInput {
  isDiscounted?: boolean | null;
  discountType?: DiscountType | string | null;
  discountPercent?: number | null;
  discountAmount?: number | null;
  discountStartsAt?: Date | string | null;
  discountEndsAt?: Date | string | null;
  wholesalePrice: number;
  retailPrice?: number | null;
  wholesaleCompareAtPrice?: number | null;
  retailCompareAtPrice?: number | null;
}

export interface ResolvedSale {
  active: boolean;
  payable: number;
  original: number | null;
  badgePercent: number;
  discountType: DiscountType | null;
}

export function roundIrr(value: number): number {
  return Math.round(Number(value) || 0);
}

export function isDiscountWindowActive(
  startsAt?: Date | string | null,
  endsAt?: Date | string | null,
  now: Date = new Date(),
): boolean {
  if (startsAt) {
    const start = new Date(startsAt);
    if (!Number.isNaN(start.getTime()) && now < start) return false;
  }
  if (endsAt) {
    const end = new Date(endsAt);
    if (!Number.isNaN(end.getTime()) && now > end) return false;
  }
  return true;
}

export function computeFinalFromBase(
  base: number,
  type: DiscountType,
  percent?: number | null,
  amount?: number | null,
): number {
  const price = roundIrr(base);
  if (!(price > 0)) {
    throw new Error('قیمت پایه باید مثبت باشد');
  }
  if (type === 'PERCENT') {
    const p = Number(percent);
    if (!(p >= 1 && p <= 99)) {
      throw new Error('درصد تخفیف باید بین ۱ تا ۹۹ باشد');
    }
    const final = roundIrr(price - (price * p) / 100);
    if (!(final > 0) || final >= price) {
      throw new Error('تخفیف درصدی باید قیمت نهایی را کمتر از قیمت پایه کند');
    }
    return final;
  }
  const a = roundIrr(Number(amount));
  if (!(a > 0) || a >= price) {
    throw new Error('مبلغ تخفیف باید از قیمت پایه کمتر باشد');
  }
  return price - a;
}

export function equivalentPercent(base: number, final: number): number {
  if (!(base > final) || !(final > 0)) return 0;
  return Math.round(((base - final) / base) * 100);
}

export function resolveChannelSale(
  product: ProductSaleInput,
  channel: SalesChannel,
  now: Date = new Date(),
): ResolvedSale {
  const final =
    channel === 'RETAIL'
      ? roundIrr(Number(product.retailPrice ?? 0))
      : roundIrr(Number(product.wholesalePrice ?? 0));
  const originalRaw =
    channel === 'RETAIL' ? product.retailCompareAtPrice : product.wholesaleCompareAtPrice;
  const original = originalRaw != null ? roundIrr(Number(originalRaw)) : null;
  const type =
    product.discountType === 'PERCENT' || product.discountType === 'FIXED'
      ? product.discountType
      : null;
  const windowOpen = isDiscountWindowActive(
    product.discountStartsAt,
    product.discountEndsAt,
    now,
  );
  const flagged = !!product.isDiscounted && windowOpen && original != null && original > final && final > 0;

  if (!flagged) {
    // Expired / not started / not flagged: charge the original list price when we have one,
    // otherwise the stored final. Never publish an expired sale price in schema.
    const payable = original && original > 0 && !windowOpen && !!product.isDiscounted ? original : final;
    return {
      active: false,
      payable: payable > 0 ? payable : final,
      original: null,
      badgePercent: 0,
      discountType: type,
    };
  }

  return {
    active: true,
    payable: final,
    original,
    badgePercent: equivalentPercent(original, final),
    discountType: type,
  };
}

export const GLOBAL_MIN_ORDER_QTY = 6;

export const GLOBAL_MIN_ORDER_COPY =
  'حداقل سفارش در محصول از 6 عدد به بالا می باشد.';

export function normalizeMinOrderQty(
  value: number | null | undefined,
  allowBelowMoq = false,
): number {
  const n = Math.max(1, Math.floor(Number(value) || GLOBAL_MIN_ORDER_QTY));
  if (!allowBelowMoq && n < GLOBAL_MIN_ORDER_QTY) {
    throw new Error(GLOBAL_MIN_ORDER_COPY);
  }
  return n;
}
