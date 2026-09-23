/**
 * Admin sales figures count an order only after it has reached SHIPPED
 * and is still a realized sale (shipped, delivered, or completed).
 * Period windows use the ship timestamp, with createdAt for older rows
 * that were shipped before shippedAt was stored.
 */

export const RECOGNIZED_SALE_STATUSES = ['SHIPPED', 'DELIVERED', 'COMPLETED'] as const;

export function recognizedSaleStatuses(): string[] {
  return [...RECOGNIZED_SALE_STATUSES];
}

export function isRecognizedSaleStatus(status?: string | null): boolean {
  const key = String(status || '').trim().toUpperCase();
  return (RECOGNIZED_SALE_STATUSES as readonly string[]).includes(key);
}

function sqlAlias(alias: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(alias)) {
    throw new Error('invalid sql alias');
  }
  return alias;
}

/** When the sale is recognized: ship time, else create time. */
export function recognizedSaleAtSql(alias = 'o'): string {
  const a = sqlAlias(alias);
  return `COALESCE(${a}.shippedAt, ${a}.createdAt)`;
}

export function recognizedSalePeriodSql(alias = 'o'): string {
  const at = recognizedSaleAtSql(alias);
  return `${at} >= :start AND ${at} <= :end`;
}
