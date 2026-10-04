/**
 * npx ts-node --transpile-only src/modules/dashboard/dashboard-low-stock.spec.ts
 */
import { LOW_STOCK_ORDER, LOW_STOCK_WHERE, isTypeOrmColumnOrder } from './dashboard-low-stock';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

for (const column of LOW_STOCK_ORDER) {
  assert(isTypeOrmColumnOrder(column), column);
}
assert(isTypeOrmColumnOrder('COALESCE(v.wholesaleStock, 0)') === false, 'function order crashes TypeORM');
assert(LOW_STOCK_WHERE.includes('wholesaleStock') && LOW_STOCK_WHERE.includes('retailStock'), 'both stocks');
assert(LOW_STOCK_ORDER.join(',') === 'v.wholesaleStock,v.retailStock', 'stable order');

console.log('dashboard-low-stock.spec.ts ok');
