/** Admin/catalog list filters. Pure — no TypeORM. */

export const UNCATEGORIZED_CATEGORY = 'uncategorized';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type CategoryListFilter =
  | { kind: 'all' }
  | { kind: 'uncategorized' }
  | { kind: 'id'; id: string }
  | { kind: 'invalid' };

export function parseCategoryListFilter(raw?: string | null): CategoryListFilter {
  const value = String(raw ?? '').trim();
  if (!value) return { kind: 'all' };
  if (value.toLowerCase() === UNCATEGORIZED_CATEGORY) return { kind: 'uncategorized' };
  if (!UUID_RE.test(value)) return { kind: 'invalid' };
  return { kind: 'id', id: value.toLowerCase() };
}

/** Empty → null. Non-UUID → 'invalid'. */
export function parseOptionalUuid(raw?: string | null): string | null | 'invalid' {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  if (!UUID_RE.test(value)) return 'invalid';
  return value.toLowerCase();
}

/** Channel stock column. No channel means either storefront still has stock. */
export function inStockPredicate(channel?: string | null): string {
  const value = String(channel || '').toUpperCase();
  if (value === 'RETAIL') return 'p.retailStock > 0';
  if (value === 'WHOLESALE') return 'p.wholesaleStock > 0';
  return '(p.retailStock > 0 OR p.wholesaleStock > 0)';
}
