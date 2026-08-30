export const PRODUCT_PAGE_UNIQUE_PREFIX = 'product:';

export function irrToTomanOnce(irr: number): number {
  return Math.max(0, Math.round(Number(irr || 0) / 10));
}

/** Retail availability source. Never use wholesaleStock or legacy stock. */
export function retailUnitStock(item?: { retailStock?: number | string | null } | null): number {
  if (!item) return 0;
  return Math.max(0, Number(item.retailStock) || 0);
}

export function sanitizeGuarantee(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const cleaned = raw
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return undefined;
  return cleaned.slice(0, 200);
}

export function pageUniqueForVariant(variantId: string): string {
  return String(variantId);
}

export function pageUniqueForProduct(productId: string): string {
  return `${PRODUCT_PAGE_UNIQUE_PREFIX}${productId}`;
}

export interface OrderedRetailVariant {
  id: string;
  retailStock?: number | string | null;
  createdAt?: Date | string | null;
}

export function sortVariantsStable<T extends OrderedRetailVariant>(variants: T[]): T[] {
  return [...variants].sort((a, b) => {
    const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    const aTs = Number.isFinite(aCreated) ? aCreated : 0;
    const bTs = Number.isFinite(bCreated) ? bCreated : 0;
    if (aTs !== bTs) return aTs - bTs;
    return String(a.id).localeCompare(String(b.id));
  });
}

export function selectDefaultRetailVariant<T extends OrderedRetailVariant>(
  variants: T[] | null | undefined,
  defaultRetailVariantId?: string | null,
): T | null {
  const ordered = sortVariantsStable(variants || []);
  if (!ordered.length) return null;
  if (defaultRetailVariantId) {
    const preferred = ordered.find((variant) => variant.id === defaultRetailVariantId);
    if (preferred) return preferred;
  }
  return ordered.find((variant) => (Number(variant.retailStock) || 0) > 0) ?? ordered[0];
}
