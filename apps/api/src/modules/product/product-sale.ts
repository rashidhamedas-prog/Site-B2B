/**
 * Dual-channel sale resolution.
 * Transaction prices remain wholesalePrice / retailPrice (final / after-discount).
 * compare-at columns are the original/base prices when a sale is configured.
 *
 * Channel flags (wholesaleIsDiscounted / retailIsDiscounted) are the source of truth.
 * Legacy shared isDiscounted is derived as OR of the two channels.
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
  wholesaleIsDiscounted?: boolean | null;
  retailIsDiscounted?: boolean | null;
  wholesaleDiscountType?: DiscountType | string | null;
  retailDiscountType?: DiscountType | string | null;
  wholesaleDiscountPercent?: number | null;
  retailDiscountPercent?: number | null;
  wholesaleDiscountAmount?: number | null;
  retailDiscountAmount?: number | null;
  wholesaleDiscountStartsAt?: Date | string | null;
  retailDiscountStartsAt?: Date | string | null;
  wholesaleDiscountEndsAt?: Date | string | null;
  retailDiscountEndsAt?: Date | string | null;
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

function channelFlag(product: ProductSaleInput, channel: SalesChannel): boolean {
  if (channel === 'RETAIL') {
    if (product.retailIsDiscounted != null) return !!product.retailIsDiscounted;
    return !!product.isDiscounted;
  }
  if (product.wholesaleIsDiscounted != null) return !!product.wholesaleIsDiscounted;
  return !!product.isDiscounted;
}

function channelType(product: ProductSaleInput, channel: SalesChannel): DiscountType | null {
  const raw =
    channel === 'RETAIL'
      ? product.retailDiscountType ?? product.discountType
      : product.wholesaleDiscountType ?? product.discountType;
  return raw === 'PERCENT' || raw === 'FIXED' ? raw : null;
}

function channelWindow(
  product: ProductSaleInput,
  channel: SalesChannel,
): { start?: Date | string | null; end?: Date | string | null } {
  if (channel === 'RETAIL') {
    return {
      start: product.retailDiscountStartsAt ?? product.discountStartsAt,
      end: product.retailDiscountEndsAt ?? product.discountEndsAt,
    };
  }
  return {
    start: product.wholesaleDiscountStartsAt ?? product.discountStartsAt,
    end: product.wholesaleDiscountEndsAt ?? product.discountEndsAt,
  };
}

export function derivedIsDiscounted(product: {
  isDiscounted?: boolean | null;
  wholesaleIsDiscounted?: boolean | null;
  retailIsDiscounted?: boolean | null;
}): boolean {
  if (product.wholesaleIsDiscounted != null || product.retailIsDiscounted != null) {
    return !!product.wholesaleIsDiscounted || !!product.retailIsDiscounted;
  }
  return !!product.isDiscounted;
}

export function applyChannelSalePrices(input: {
  baseIrr: number;
  enabled: boolean;
  type?: DiscountType | string | null;
  percent?: number | null;
  amountIrr?: number | null;
}): { final: number; compareAt: number | null } {
  const base = roundIrr(input.baseIrr);
  if (!(base > 0)) {
    throw new Error('قیمت اصلی باید مثبت باشد');
  }
  if (!input.enabled) {
    return { final: base, compareAt: null };
  }
  const type: DiscountType = input.type === 'FIXED' ? 'FIXED' : 'PERCENT';
  const final = computeFinalFromBase(base, type, input.percent, input.amountIrr);
  if (!(base > final) || !(final > 0)) {
    throw new Error('در تخفیف فعال باید قیمت قبل از تخفیف از قیمت نهایی بیشتر باشد');
  }
  return { final, compareAt: base };
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
  const type = channelType(product, channel);
  const window = channelWindow(product, channel);
  const windowOpen = isDiscountWindowActive(window.start, window.end, now);
  const flagged = channelFlag(product, channel) && windowOpen && original != null && original > final && final > 0;

  if (!flagged) {
    const payable =
      original && original > 0 && !windowOpen && channelFlag(product, channel) ? original : final;
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

/** @deprecated min order is pack count; kept as 1 for callers still importing the name. */
export const GLOBAL_MIN_ORDER_QTY = 1;

export const GLOBAL_MIN_ORDER_COPY = 'حداقل سفارش باید حداقل ۱ پک باشد.';

export function normalizeMinOrderQty(value: number | null | undefined, _allowBelowMoq = false): number {
  void _allowBelowMoq;
  const n = Math.floor(Number(value ?? GLOBAL_MIN_ORDER_QTY));
  if (!Number.isFinite(n) || n < 1) {
    throw new Error(GLOBAL_MIN_ORDER_COPY);
  }
  return n;
}
