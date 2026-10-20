import { ProductSizeType } from './entities/product-specs';

export const DEFAULT_MIN_PACK_QTY = 1;

/** Product-level pack rules. Distinct from cart `packMode` boolean (ordering by packs). */
export type PackDefinitionMode = 'AUTO' | 'MANUAL';

export type PackSizeConfig = {
  sizeType?: string | null;
  sizeLabels?: string[] | null;
  packDefinitionMode?: string | null;
  packComposition?: Record<string, number> | null;
};

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

export function normalizePackDefinitionMode(raw?: string | null): PackDefinitionMode {
  return String(raw || 'AUTO').toUpperCase() === 'MANUAL' ? 'MANUAL' : 'AUTO';
}

/**
 * Resolve size labels for a product.
 * Presets ignore custom labels; CUSTOM requires `sizeLabels`.
 */
export function sizesForSizeType(
  sizeType?: string | null,
  sizeLabels?: Array<string | null | undefined> | null,
): string[] {
  const t = String(sizeType || 'FREE').toUpperCase() as ProductSizeType | string;
  if (t === 'CUSTOM') {
    return normalizeSizeLabels(sizeLabels);
  }
  if (t === 'TWO') return ['سایز ۱', 'سایز ۲'];
  if (t === 'THREE') return ['سایز ۱', 'سایز ۲', 'سایز ۳'];
  return ['فری سایز'];
}

export function distinctColorNames(colors: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of colors) {
    const name = String(raw || '').trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

/** Qty of each size included once per selected color inside one pack. */
export function compositionPerSize(config: PackSizeConfig = {}): Record<string, number> {
  const sizes = sizesForSizeType(config.sizeType, config.sizeLabels);
  const mode = normalizePackDefinitionMode(config.packDefinitionMode);
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

/** Pieces contributed by one color in one pack (sum of size slots). */
export function piecesPerColorInPack(config: PackSizeConfig = {}): number {
  return Object.values(compositionPerSize(config)).reduce((sum, n) => sum + n, 0);
}

/**
 * Pack size = distinct colors × pieces-per-color.
 * AUTO: pieces-per-color = size count (1 each).
 * MANUAL: pieces-per-color = sum(packComposition).
 * Never trust a client packQty for AUTO; MANUAL composition is admin-authored server state.
 */
export function computePackQty(
  colors: Array<string | null | undefined>,
  sizeTypeOrConfig?: string | null | PackSizeConfig,
  maybeConfig?: PackSizeConfig,
): number {
  const config: PackSizeConfig =
    sizeTypeOrConfig && typeof sizeTypeOrConfig === 'object'
      ? sizeTypeOrConfig
      : { sizeType: sizeTypeOrConfig as string | null | undefined, ...(maybeConfig || {}) };
  const colorCount = distinctColorNames(colors).length;
  return colorCount * piecesPerColorInPack(config);
}

export function normalizeMinPackQty(value: number | string | null | undefined): number {
  const n = Math.floor(Number(value ?? DEFAULT_MIN_PACK_QTY));
  if (!Number.isFinite(n) || n < 1) {
    throw new Error('حداقل سفارش باید حداقل ۱ پک باشد');
  }
  return n;
}

export function minOrderPieces(minPackQty: number, packQty: number): number {
  return Math.max(1, minPackQty) * Math.max(0, packQty);
}

export function packSummaryFa(minPackQty: number, packQty: number): string {
  const packs = normalizeMinPackQty(minPackQty);
  const pieces = Math.max(0, packQty);
  const total = minOrderPieces(packs, pieces);
  const fa = (n: number) => n.toLocaleString('fa-IR');
  return `حداقل ${fa(packs)} پک — هر پک ${fa(pieces)} عدد — مجموع حداقل سفارش ${fa(total)} عدد`;
}

export type NormalizedPackSizeFields = {
  sizeType: ProductSizeType;
  sizeLabels: string[] | null;
  sizeGuideLines: string[] | null;
  packDefinitionMode: PackDefinitionMode;
  packComposition: Record<string, number> | null;
};

/**
 * Validate and normalize admin size/pack fields.
 * XOR: MANUAL stores composition; AUTO clears composition.
 */
export function normalizeProductPackSizeFields(input: {
  sizeType?: string | null;
  sizeLabels?: Array<string | null | undefined> | null;
  sizeGuideLines?: Array<string | null | undefined> | null;
  packDefinitionMode?: string | null;
  packComposition?: Record<string, number> | null;
}): NormalizedPackSizeFields {
  const rawType = String(input.sizeType || 'FREE').toUpperCase();
  if (!['FREE', 'TWO', 'THREE', 'CUSTOM'].includes(rawType)) {
    throw new Error('نوع سایزبندی نامعتبر است');
  }
  const sizeType = rawType as ProductSizeType;
  const labels = normalizeSizeLabels(input.sizeLabels);
  const guide = normalizeSizeLabels(input.sizeGuideLines);

  if (sizeType === 'CUSTOM') {
    if (labels.length < 1) {
      throw new Error('برای سایزبندی سفارشی حداقل یک سایز لازم است');
    }
    if (labels.length > 24) {
      throw new Error('حداکثر ۲۴ سایز سفارشی مجاز است');
    }
  }

  const packDefinitionMode = normalizePackDefinitionMode(input.packDefinitionMode);
  const resolvedSizes = sizesForSizeType(sizeType, labels);

  if (packDefinitionMode === 'MANUAL') {
    if (!resolvedSizes.length) {
      throw new Error('برای پک دستی ابتدا سایزبندی را تعریف کنید');
    }
    const composition = compositionPerSize({
      sizeType,
      sizeLabels: labels,
      packDefinitionMode: 'MANUAL',
      packComposition: input.packComposition,
    });
    const total = Object.values(composition).reduce((sum, n) => sum + n, 0);
    if (total < 1) {
      throw new Error('در پک دستی مجموع تعداد سایزها باید حداقل ۱ باشد');
    }
    for (const [size, qty] of Object.entries(composition)) {
      if (qty > 99) {
        throw new Error(`تعداد «${size}» در پک دستی بیش از حد مجاز است`);
      }
    }
    return {
      sizeType,
      sizeLabels: sizeType === 'CUSTOM' ? labels : null,
      sizeGuideLines: guide.length ? guide : null,
      packDefinitionMode: 'MANUAL',
      packComposition: composition,
    };
  }

  return {
    sizeType,
    sizeLabels: sizeType === 'CUSTOM' ? labels : null,
    sizeGuideLines: guide.length ? guide : null,
    packDefinitionMode: 'AUTO',
    packComposition: null,
  };
}
