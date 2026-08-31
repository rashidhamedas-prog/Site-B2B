/**
 * npx ts-node --transpile-only src/modules/product/color-stock-plan.spec.ts
 */
import { parseColorStockPlan, pickVariantStocks } from './color-stock-plan';
import { isAdminActor } from './optional-jwt.guard';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

{
  const picked = pickVariantStocks({ stock: 8, retailStock: 3 });
  assert(picked.wholesale === undefined, 'legacy stock is ignored');
  assert(picked.retail === 3, 'retail kept');
  assert(pickVariantStocks({ wholesaleStock: 8, stock: 99 }).wholesale === 8, 'wholesale column wins');
}

{
  const plan = parseColorStockPlan(
    { sizes: [{ size: 'M', wholesaleStock: 4, retailStock: 1 }] },
    ['S', 'M'],
  );
  assert(plan.get('M')?.wholesale === 4, 'per-size wholesale');
  assert(plan.get('S') === undefined, 'unlisted size omitted');
}

{
  const plan = parseColorStockPlan({ wholesaleStock: 10, retailStock: 2 }, ['۱', '۲']);
  assert(plan.get('۱')?.wholesale === 10 && plan.get('۱')?.retail === 2, 'first size gets pool');
  assert(plan.get('۲')?.wholesale === 0 && plan.get('۲')?.retail === 0, 'siblings zeroed');
}

assert(isAdminActor({ role: 'ADMIN' }) === true, 'admin actor');
assert(isAdminActor({ role: 'CUSTOMER' }) === false, 'customer not admin');
assert(isAdminActor(null) === false, 'anon not admin');

console.log('color-stock-plan.spec.ts: ok');
