/** Shared storefront display helpers. Prices are IRR; UI shows toman. */

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

export function sizeTypeLabel(sizeType?: string | null): string {
  if (sizeType === 'FREE') return 'فری‌سایز';
  if (sizeType === 'TWO') return '۲ سایز';
  if (sizeType === 'THREE') return '۳ سایز';
  return sizeType || 'سایزبندی کامل';
}

export function uniqueByColor<T extends { color?: string | null }>(variants: T[]): T[] {
  return [...new Map(variants.filter((v) => v.color).map((v) => [v.color, v])).values()];
}

export function uniqueSizes(variants: Array<{ size?: string | null }>): string[] {
  return [...new Set(variants.map((v) => v.size).filter((s): s is string => !!s))];
}

export function packPieces(colorCount: number, sizeCount: number): number {
  return Math.max(1, Math.max(0, colorCount) * Math.max(0, sizeCount));
}

export function meetsMoq(totalPieces: number, moq: number): boolean {
  const min = Math.max(1, moq);
  return totalPieces >= min;
}
