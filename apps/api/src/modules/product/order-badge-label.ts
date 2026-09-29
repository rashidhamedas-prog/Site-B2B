/** Empty → null; strip controls; max 80 chars. Shared rule with storefront badge. */
export function normalizeOrderBadgeLabel(raw: unknown): string | null {
  if (raw == null) return null;
  const text = String(raw)
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return text || null;
}
