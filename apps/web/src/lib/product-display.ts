/**
 * PDP hero slot. Matches `.pdp-main-frame`: below 1024px the width is the
 * content box (px-4 / sm:px-6) or the 3:4 height cap, whichever is smaller.
 * A 390px phone at DPR 2 then selects the 720 candidate instead of 828 from
 * a 100vw slot. `env(safe-area-inset-bottom)` is left out of `sizes` because
 * Chrome drops the whole candidate when `env()` appears there. Desktop column
 * stays 640 CSS pixels.
 */
export const PDP_MAIN_IMAGE_SIZES =
  '(max-width: 639px) min(calc(100vw - 2rem), calc((100svh - 22rem) * 0.75)), (max-width: 1023px) min(calc(100vw - 3rem), calc((100svh - 22rem) * 0.75)), 640px';

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

export type PackDefinitionMode = 'AUTO' | 'MANUAL';

export type PackSizeConfig = {
  sizeType?: string | null;
  sizeLabels?: string[] | null;
  packDefinitionMode?: string | null;
  packComposition?: Record<string, number> | null;
};

/**
 * Chart / variant token for FREE (ERP + DB + match). ASCII space — do not ZWNJ.
 * Display copy uses {@link FREE_SIZE_FILTER_LABEL}.
 */
export const FREE_SIZE_CHART_LABEL = 'فری سایز';
/** Filter / summary UI label (ZWNJ). Never write this into variant.size. */
export const FREE_SIZE_FILTER_LABEL = 'فری‌سایز';

/** Shared size-type summary for filters and badges (CUSTOM → caller uses sizeLabels). */
export const SIZE_TYPE_SUMMARY: Record<'FREE' | 'TWO' | 'THREE', string> = {
  FREE: FREE_SIZE_FILTER_LABEL,
  TWO: 'سایز ۱ و ۲',
  THREE: 'سایز ۱ تا ۳',
};

/** Sizing fields needed on catalog cards (mirror wholesale slim). */
export type CatalogSizing = {
  sizeType?: string | null;
  sizeLabels?: string[] | null;
  packDefinitionMode?: string | null;
  packComposition?: Record<string, number> | null;
};

export function pickCatalogSizing(
  raw: Record<string, unknown> | null | undefined,
): CatalogSizing {
  const src = raw ?? {};
  return {
    sizeType: src.sizeType == null || src.sizeType === '' ? null : String(src.sizeType),
    sizeLabels: Array.isArray(src.sizeLabels)
      ? normalizeSizeLabels(src.sizeLabels as Array<string | null | undefined>)
      : null,
    packDefinitionMode:
      src.packDefinitionMode == null || src.packDefinitionMode === ''
        ? null
        : String(src.packDefinitionMode),
    packComposition:
      src.packComposition && typeof src.packComposition === 'object'
        ? (src.packComposition as Record<string, number>)
        : null,
  };
}

export function sizeTypeLabel(sizeType?: string | null): string {
  if (sizeType === 'FREE') return FREE_SIZE_FILTER_LABEL;
  if (sizeType === 'TWO') return '۲ سایز';
  if (sizeType === 'THREE') return '۳ سایز';
  if (sizeType === 'CUSTOM') return 'سایزبندی سفارشی';
  return sizeType || 'سایزبندی کامل';
}

/** Chip / filter display: chart FREE token → ZWNJ label; others pass through. */
export function displaySizeLabel(label: string): string {
  return label === FREE_SIZE_CHART_LABEL ? FREE_SIZE_FILTER_LABEL : label;
}

export function normalizeSizeLabels(raw?: Array<string | null | undefined> | null): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw ?? []) {
    const label = String(item ?? '').trim();
    if (!label || seen.has(label)) continue;
    seen.add(label);
    out.push(label);
  }
  return out;
}

/**
 * Chart rows for a known sizeType. Missing/invalid → [] (never invent FREE).
 * Callers that need pack defaults must pass sizeType ?? 'FREE' explicitly.
 */
export function sizesForSizeType(
  sizeType?: string | null,
  sizeLabels?: Array<string | null | undefined> | null,
): string[] {
  const t = String(sizeType ?? '')
    .trim()
    .toUpperCase();
  if (!t) return [];
  if (t === 'CUSTOM') return normalizeSizeLabels(sizeLabels);
  if (t === 'TWO') return ['سایز ۱', 'سایز ۲'];
  if (t === 'THREE') return ['سایز ۱', 'سایز ۲', 'سایز ۳'];
  if (t === 'FREE') return [FREE_SIZE_CHART_LABEL];
  return [];
}

/** FREE=1, TWO=2, THREE=3, CUSTOM=label count. Unknown/missing → null. */
export function sizeCountForType(
  sizeType?: string | null,
  sizeLabels?: Array<string | null | undefined> | null,
): number | null {
  const t = String(sizeType || '').toUpperCase();
  if (t === 'FREE') return 1;
  if (t === 'TWO') return 2;
  if (t === 'THREE') return 3;
  if (t === 'CUSTOM') {
    const n = normalizeSizeLabels(sizeLabels).length;
    return n > 0 ? n : null;
  }
  return null;
}

export function compositionPerSize(config: PackSizeConfig = {}): Record<string, number> {
  // Pack math historically treated missing type as FREE — keep that explicit here.
  const sizes = sizesForSizeType(config.sizeType ?? 'FREE', config.sizeLabels);
  const mode = String(config.packDefinitionMode || 'AUTO').toUpperCase() === 'MANUAL' ? 'MANUAL' : 'AUTO';
  const out: Record<string, number> = {};
  if (mode === 'AUTO') {
    for (const size of sizes) out[size] = 1;
    return out;
  }
  const raw = config.packComposition && typeof config.packComposition === 'object'
    ? config.packComposition
    : {};
  for (const size of sizes) {
    const n = Math.floor(Number((raw as Record<string, unknown>)[size] ?? 0));
    out[size] = Number.isFinite(n) && n >= 0 ? n : 0;
  }
  return out;
}

export function piecesPerColorInPack(config: PackSizeConfig = {}): number {
  return Object.values(compositionPerSize(config)).reduce((sum, n) => sum + n, 0);
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

export type SizeChartSource = {
  sizeType?: string | null;
  sizeLabels?: Array<string | null | undefined> | null;
};

/**
 * Drop variant sizes outside the product size chart (e.g. leftover «فری سایز»
 * after FREE → CUSTOM). Empty CUSTOM chart → no filter (mid-edit safety).
 */
export function variantsOnSizeChart<T extends { size?: string | null }>(
  variants: T[] | null | undefined,
  source: SizeChartSource,
): T[] {
  const rows = variants ?? [];
  const allowed = sizesForSizeType(source.sizeType, source.sizeLabels);
  if (!allowed.length) return rows;
  const set = new Set(allowed);
  return rows.filter((row) => {
    const size = String(row.size ?? '').trim();
    return !size || set.has(size);
  });
}

/** Size labels for cards/PDP: chart when defined, else distinct variant sizes. */
export function storefrontSizeLabels<T extends ChannelStockVariant & { size?: string | null }>(
  variants: T[] | null | undefined,
  source: SizeChartSource,
  options?: { channel?: StorefrontChannel; includeSoldOut?: boolean },
): string[] {
  const onChart = variantsOnSizeChart(variants, source);
  const channel = options?.channel;
  const scoped = channel
    ? variantsInStock(onChart, channel, { includeSoldOut: options?.includeSoldOut })
    : onChart;
  const fromVariants = uniqueSizes(scoped);
  const chart = sizesForSizeType(source.sizeType, source.sizeLabels);
  if (!chart.length) return fromVariants;
  // Prefer chart order; only include labels that still have a variant row (or all chart if none).
  const present = new Set(fromVariants);
  const ordered = chart.filter((label) => present.has(label));
  return ordered.length ? ordered : chart;
}

export type StorefrontSizeChip = { label: string; available: boolean };

/**
 * Card chips: chart labels when known. If list payload has no size rows, all chips
 * are available (no per-size stock). When variants include sizes, retailStock=0 → unavailable.
 */
export function storefrontSizeChips<T extends ChannelStockVariant & { size?: string | null }>(
  variants: T[] | null | undefined,
  source: SizeChartSource,
  options?: { channel?: StorefrontChannel; includeSoldOut?: boolean },
): StorefrontSizeChip[] {
  const labels = storefrontSizeLabels(variants, source, {
    ...options,
    includeSoldOut: true,
  });
  const rows = variants ?? [];
  const hasSizeRows = rows.some((row) => String(row.size ?? '').trim());
  if (!hasSizeRows || options?.includeSoldOut) {
    return labels.map((label) => ({ label, available: true }));
  }
  const channel = options?.channel ?? 'retail';
  return labels.map((label) => {
    const matching = rows.filter((row) => String(row.size ?? '').trim() === label);
    const available = matching.some((row) => variantChannelStock(row, channel) > 0);
    return { label, available };
  });
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

/**
 * Prefer product pack config (AUTO/MANUAL + CUSTOM labels).
 * Legacy callers may pass sizeType string + fallbackSizes.
 */
export function piecesPerPackCount(
  colors: Array<string | null | undefined>,
  sizeTypeOrConfig?: string | null | PackSizeConfig,
  fallbackSizes?: Array<string | null | undefined>,
): number {
  const colorCount = distinctColorCount(colors);
  const config: PackSizeConfig =
    sizeTypeOrConfig && typeof sizeTypeOrConfig === 'object'
      ? sizeTypeOrConfig
      : { sizeType: sizeTypeOrConfig as string | null | undefined };

  if (String(config.packDefinitionMode || 'AUTO').toUpperCase() === 'MANUAL') {
    const perColor = piecesPerColorInPack(config);
    return Math.max(0, colorCount * perColor);
  }

  const typed = sizeCountForType(config.sizeType, config.sizeLabels);
  const sizeCount =
    typed ?? uniqueSizes((fallbackSizes ?? []).map((size) => ({ size }))).length;
  return packPieces(colorCount, sizeCount);
}

export function meetsMoq(totalPieces: number, moq: number): boolean {
  const min = Math.max(1, moq);
  return totalPieces >= min;
}
