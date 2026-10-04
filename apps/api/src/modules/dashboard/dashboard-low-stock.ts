/**
 * Low-stock selection for the admin desk.
 *
 * The filter may use SQL. The sort must be a real `alias.column` path.
 * TypeORM splits orderBy on the first dot, so `COALESCE(v.wholesaleStock, 0)`
 * becomes the alias `COALESCE(v` and getStats throws before any card can load.
 */

export const LOW_STOCK_WHERE =
  '(COALESCE(v.wholesaleStock, 0) < 10 OR COALESCE(v.retailStock, 0) < 10)';

export const LOW_STOCK_ORDER = ['v.wholesaleStock', 'v.retailStock'] as const;

const COLUMN_ORDER = /^[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*$/;

export function isTypeOrmColumnOrder(expression: string): boolean {
  return COLUMN_ORDER.test(expression);
}
