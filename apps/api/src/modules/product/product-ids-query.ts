const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const PRODUCT_IDS_QUERY_MAX = 16;

export function parseProductIdsQuery(raw?: string | string[] | null, max = PRODUCT_IDS_QUERY_MAX): string[] {
  const parts = Array.isArray(raw)
    ? raw.flatMap((item) => String(item || '').split(/[,\s]+/))
    : String(raw || '').split(/[,\s]+/);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const id = part.trim().toLowerCase();
    if (!UUID_RE.test(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= max) break;
  }
  return out;
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
