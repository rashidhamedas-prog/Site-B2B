/**
 * Wholesale catalog chip next to the order CTA.
 * Custom text wins; otherwise MOQ is shown as packs (not pieces).
 */
export function resolveWholesaleOrderBadge(input: {
  orderBadgeLabel?: string | null;
  minOrderQty?: number | null;
  minimumOrderQuantity?: number | null;
}): string {
  const custom = String(input.orderBadgeLabel ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (custom) return custom.slice(0, 80);

  const raw = input.minOrderQty ?? input.minimumOrderQuantity ?? 1;
  const n = Math.floor(Number(raw));
  const packs = Number.isFinite(n) && n >= 1 ? n : 1;
  return `حداقل ${packs.toLocaleString('fa-IR')} پک`;
}

/** Persist: empty → null; strip controls; cap length. */
export function normalizeOrderBadgeLabel(raw: unknown): string | null {
  if (raw == null) return null;
  const text = String(raw)
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return text || null;
}
