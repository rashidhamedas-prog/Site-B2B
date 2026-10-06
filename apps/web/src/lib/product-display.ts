/** Shared storefront display helpers. Prices are IRR; UI shows toman. */

export type ChannelSale = {
  active?: boolean;
  payable?: number;
  original?: number | null;
  badgePercent?: number;
};

export function mediaUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http') || url.startsWith('/')) return url;
  return `/media/${url}`;
}

/**
 * Prices are stored as IRR; UI shows toman.
 * Snap values within 1 toman of a round هزار تومان (off-by-10 IRR from admin entry).
 */
export function toman(value: number): string {
  const raw = Math.round(Number(value) / 10);
  const nearestThousand = Math.round(raw / 1000) * 1000;
  const snapped = Math.abs(raw - nearestThousand) <= 1 ? nearestThousand : raw;
  return snapped.toLocaleString('fa-IR');
}

export function discountPercent(price: number, compareAt: number): number {
  if (!(compareAt > price) || !(price > 0)) return 0;
  return Math.round(((compareAt - price) / compareAt) * 100);
}

/** Use API `sale.payable`. After an expired window, payable is the list price. */
export function channelSaleDisplay(
  sale?: ChannelSale | null,
  fallbackPrice?: number | null,
): { price: number; compareAt: number; discount: number; active: boolean } {
  const price = Number(sale?.payable ?? fallbackPrice ?? 0);
  const active = Boolean(sale?.active);
  const compareAt = active ? Number(sale?.original ?? 0) : 0;
  const discount = active ? Number(sale?.badgePercent || 0) : 0;
  return { price, compareAt, discount, active };
}

export function sizeTypeLabel(sizeType?: string | null): string {
  if (sizeType === 'FREE') return 'فری‌سایز';
  if (sizeType === 'TWO') return '۲ سایز';
  if (sizeType === 'THREE') return '۳ سایز';
  return sizeType || 'سایزبندی کامل';
}

/** FREE=1, TWO=2, THREE=3. Unknown/missing → null so callers can fall back to variants. */
export function sizeCountForType(sizeType?: string | null): number | null {
  const t = String(sizeType || '').toUpperCase();
  if (t === 'FREE') return 1;
  if (t === 'TWO') return 2;
  if (t === 'THREE') return 3;
  return null;
}

export function uniqueByColor<T extends { color?: string | null }>(variants: T[]): T[] {
  return [...new Map(variants.filter((v) => v.color).map((v) => [v.color, v])).values()];
}

export type StorefrontChannel = 'retail' | 'wholesale';

type ChannelStockVariant = {
  color?: string | null;
  retailStock?: number | null;
  wholesaleStock?: number | null;
  stock?: number | null;
};

/** Channel column wins. Legacy `stock` is only a fallback when that column is absent. */
export function variantChannelStock(variant: ChannelStockVariant, channel: StorefrontChannel): number {
  const raw = channel === 'retail' ? variant.retailStock : variant.wholesaleStock;
  if (raw !== undefined && raw !== null) {
    const units = Number(raw);
    return Number.isFinite(units) ? Math.max(0, units) : 0;
  }
  const fallback = Number(variant.stock);
  return Number.isFinite(fallback) ? Math.max(0, fallback) : 0;
}

/**
 * One row per color that still has units on this channel.
 * A color with stock on any size stays. Pre-order / coming-soon callers pass includeSoldOut.
 */
export function uniqueInStockColors<T extends ChannelStockVariant>(
  variants: T[],
  channel: StorefrontChannel,
  options?: { includeSoldOut?: boolean },
): T[] {
  if (options?.includeSoldOut) return uniqueByColor(variants);
  const totals = new Map<string, number>();
  for (const variant of variants) {
    if (!variant.color) continue;
    totals.set(variant.color, (totals.get(variant.color) ?? 0) + variantChannelStock(variant, channel));
  }
  return uniqueByColor(variants.filter((variant) => !!variant.color && (totals.get(variant.color) ?? 0) > 0));
}

/** Size rows that belong to a color still shown on this channel. */
export function variantsInStock<T extends ChannelStockVariant>(
  variants: T[],
  channel: StorefrontChannel,
  options?: { includeSoldOut?: boolean },
): T[] {
  if (options?.includeSoldOut) return variants;
  const open = new Set(uniqueInStockColors(variants, channel).map((variant) => variant.color));
  return variants.filter((variant) => !variant.color || open.has(variant.color));
}

export function uniqueSizes(variants: Array<{ size?: string | null }>): string[] {
  return [...new Set(variants.map((v) => v.size).filter((s): s is string => !!s))];
}

export function distinctColorCount(colors: Array<string | null | undefined>): number {
  const seen = new Set<string>();
  for (const raw of colors) {
    const name = String(raw || '').trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
  }
  return seen.size;
}

export function packPieces(colorCount: number, sizeCount: number): number {
  return Math.max(1, Math.max(0, colorCount) * Math.max(0, sizeCount));
}

/** Prefer sizeType sizes; if missing, fall back to distinct variant sizes. Duplicate colors count once. */
export function piecesPerPackCount(
  colors: Array<string | null | undefined>,
  sizeType?: string | null,
  fallbackSizes?: Array<string | null | undefined>,
): number {
  const colorCount = distinctColorCount(colors);
  const typed = sizeCountForType(sizeType);
  const sizeCount =
    typed ?? uniqueSizes((fallbackSizes ?? []).map((size) => ({ size }))).length;
  return packPieces(colorCount, sizeCount);
}

export function meetsMoq(totalPieces: number, moq: number): boolean {
  const min = Math.max(1, moq);
  return totalPieces >= min;
}
