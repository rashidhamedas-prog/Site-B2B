import { BadRequestException } from '@nestjs/common';

export type ProductChannelPriceInput = {
  wholesalePrice?: unknown;
  retailPrice?: unknown;
  wholesaleCompareAtPrice?: unknown;
  retailCompareAtPrice?: unknown;
  /** Defaults true (create). When false, retailPrice may be null. */
  showOnRetail?: boolean;
  /**
   * Defaults true. Display gating only — DB column wholesalePrice is NOT NULL,
   * so a positive wholesale final is always required regardless of this flag.
   */
  showOnWholesale?: boolean;
};

export type ProductChannelPrices = {
  wholesalePrice: number;
  retailPrice: number | null;
  wholesaleCompareAtPrice: number | null;
  retailCompareAtPrice: number | null;
};

/**
 * Parse IRR money: null/'' → null; reject NaN/negative/non-integer/unsafe-huge.
 * Zero is syntactically parseable; channel finals still require > 0 below.
 */
function parseIrr(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'bigint') {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      throw new BadRequestException('مبلغ ریالی نامعتبر است');
    }
    if (n > Number.MAX_SAFE_INTEGER) {
      throw new BadRequestException('مبلغ خارج از محدوده امن Number است');
    }
    return n;
  }
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
    throw new BadRequestException('مبلغ ریالی باید عدد صحیح غیرمنفی (ریال) باشد');
  }
  if (n > Number.MAX_SAFE_INTEGER) {
    throw new BadRequestException('مبلغ خارج از محدوده امن Number است');
  }
  return n;
}

/**
 * HIGH-5 channel pricing invariant (create + update):
 * - wholesalePrice / retailPrice = FINAL transaction prices (after discount)
 * - compare-at optional; when set must be STRICTLY greater than that channel's final
 * - showOnRetail true (default): retailPrice required, positive (> 0)
 * - showOnRetail false: retailPrice may be null (clearing final only allowed off-channel)
 * - wholesalePrice always required positive (> 0) — DB column is NOT NULL;
 *   showOnWholesale only gates storefront display, not column nullability
 * - zero / negative / NaN / > MAX_SAFE_INTEGER rejected
 */
export function normalizeProductChannelPrices(
  input: ProductChannelPriceInput,
): ProductChannelPrices {
  const showOnRetail = input.showOnRetail !== false;

  const wholesalePrice = parseIrr(input.wholesalePrice);
  if (wholesalePrice === null || wholesalePrice <= 0) {
    throw new BadRequestException('قیمت نهایی عمده الزامی است و باید مثبت باشد');
  }

  const retailPrice = parseIrr(input.retailPrice);
  if (showOnRetail) {
    if (retailPrice === null || retailPrice <= 0) {
      throw new BadRequestException(
        'قیمت نهایی تکی برای نمایش در فروشگاه تکی الزامی است و باید مثبت باشد',
      );
    }
  } else if (retailPrice !== null && retailPrice <= 0) {
    throw new BadRequestException('قیمت نهایی تکی در صورت ارسال باید مثبت باشد');
  }

  const wholesaleCompareAtPrice = parseIrr(input.wholesaleCompareAtPrice);
  const retailCompareAtPrice = parseIrr(input.retailCompareAtPrice);

  if (wholesaleCompareAtPrice !== null && wholesaleCompareAtPrice <= wholesalePrice) {
    throw new BadRequestException('قیمت قبل از تخفیف عمده باید از قیمت نهایی بیشتر باشد');
  }
  if (retailCompareAtPrice !== null) {
    if (retailPrice === null) {
      throw new BadRequestException('قیمت قبل از تخفیف تکی بدون قیمت نهایی معتبر نیست');
    }
    if (retailCompareAtPrice <= retailPrice) {
      throw new BadRequestException('قیمت قبل از تخفیف تکی باید از قیمت نهایی بیشتر باشد');
    }
  }

  return {
    wholesalePrice,
    retailPrice,
    wholesaleCompareAtPrice,
    retailCompareAtPrice,
  };
}
