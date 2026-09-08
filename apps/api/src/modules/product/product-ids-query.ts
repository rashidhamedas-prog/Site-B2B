const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Catalog SKUs like WINTER-WEAR00009 — must include a digit so prose tokens are dropped. */
const SKU_RE = /^[a-z0-9][a-z0-9_-]{0,46}\d[a-z0-9_-]{0,46}$/i;

export const PRODUCT_IDS_QUERY_MAX = 16;

export type MerchRef = { kind: 'id' | 'sku'; value: string };

export function isProductUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function parseMerchandisingRefs(raw?: string | string[] | null, max = PRODUCT_IDS_QUERY_MAX): MerchRef[] {
  const parts = Array.isArray(raw)
    ? raw.flatMap((item) => String(item || '').split(/[,\s]+/))
    : String(raw || '').split(/[,\s]+/);
  const seen = new Set<string>();
  const out: MerchRef[] = [];
  for (const part of parts) {
    const token = part.trim();
    if (!token) continue;
    const kind: MerchRef['kind'] | null = UUID_RE.test(token)
      ? 'id'
      : SKU_RE.test(token) && token.length <= 48
        ? 'sku'
        : null;
    if (!kind) continue;
    const value = kind === 'id' ? token.toLowerCase() : token.toUpperCase();
    const key = `${kind}:${value.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ kind, value });
    if (out.length >= max) break;
  }
  return out;
}

/** UUID merchandising tokens only (legacy helper). SKUs need resolveCuratedProductIds. */
export function parseProductIdsQuery(raw?: string | string[] | null, max = PRODUCT_IDS_QUERY_MAX): string[] {
  return parseMerchandisingRefs(raw, max)
    .filter((ref) => ref.kind === 'id')
    .map((ref) => ref.value);
}

export function shouldForceEmptyMerchandisingResult(
  requestedRefs: string[] | undefined,
  resolvedIds: string[],
): boolean {
  return Array.isArray(requestedRefs) && resolvedIds.length === 0;
}

export function merchandisingOrderSql(alias: string, ids: string[]): { sql: string; params: Record<string, string> } {
  if (!ids.length) return { sql: `${alias}.createdAt`, params: {} };
  const params: Record<string, string> = {};
  const cases = ids.map((id, index) => {
    const key = `moid${index}`;
    params[key] = id;
    return `WHEN :${key} THEN ${index}`;
  });
  return {
    sql: `CASE ${alias}.id ${cases.join(' ')} ELSE ${ids.length} END`,
    params,
  };
}
