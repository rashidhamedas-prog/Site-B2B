import { ProductSizeType } from './entities/product-specs';

export const DEFAULT_MIN_PACK_QTY = 1;

export function sizesForSizeType(sizeType?: string | null): string[] {
  const t = String(sizeType || 'FREE').toUpperCase() as ProductSizeType | string;
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

/** Pack size = distinct colors × valid sizes for sizeType. Never trust a client packQty. */
export function computePackQty(
  colors: Array<string | null | undefined>,
  sizeType?: string | null,
): number {
  const colorCount = distinctColorNames(colors).length;
  const sizeCount = sizesForSizeType(sizeType).length;
  return colorCount * sizeCount;
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
