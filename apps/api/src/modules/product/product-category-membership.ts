/** Pure membership helpers — no TypeORM. */

export const MAX_PRODUCT_CATEGORIES = 8;

export type MembershipRow = {
  categoryId: string;
  isPrimary: boolean;
  sortOrder: number;
};

function uniqueIds(ids: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of ids) {
    const id = String(raw || '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Primary is always first and isPrimary. Extra ids are appended, primary de-duped.
 * Empty extra list still yields the primary row when primaryId is set.
 */
export function resolveMembershipRows(
  primaryId: string | null | undefined,
  extraIds?: Array<string | null | undefined> | null,
): MembershipRow[] {
  const primary = String(primaryId || '').trim();
  if (!primary) return [];
  const extras = uniqueIds(extraIds ?? []).filter((id) => id !== primary);
  const ids = [primary, ...extras].slice(0, MAX_PRODUCT_CATEGORIES);
  return ids.map((categoryId, sortOrder) => ({
    categoryId,
    isPrimary: sortOrder === 0,
    sortOrder,
  }));
}
