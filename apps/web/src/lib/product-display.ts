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

export function toman(value: number): string {
  return Math.round(Number(value) / 10).toLocaleString('fa-IR');
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
