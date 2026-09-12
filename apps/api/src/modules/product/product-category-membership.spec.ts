/**
 * npx ts-node --transpile-only src/modules/product/product-category-membership.spec.ts
 */
import { MAX_PRODUCT_CATEGORIES, resolveMembershipRows } from './product-category-membership';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(resolveMembershipRows('', ['a']).length === 0, 'no primary → no rows');
assert(JSON.stringify(resolveMembershipRows('p1')) === JSON.stringify([
  { categoryId: 'p1', isPrimary: true, sortOrder: 0 },
]), 'primary only when extras omitted');

const withExtras = resolveMembershipRows('p1', ['p1', 'c2', 'c2', 'c3']);
assert(withExtras.length === 3, 'dedupe primary + extras');
assert(withExtras[0].isPrimary && withExtras[0].categoryId === 'p1', 'primary first');
assert(withExtras[1].categoryId === 'c2' && !withExtras[1].isPrimary, 'first extra');
assert(withExtras[2].categoryId === 'c3' && withExtras[2].sortOrder === 2, 'second extra');

const many = resolveMembershipRows(
  'p1',
  Array.from({ length: 20 }, (_, i) => `c${i}`),
);
assert(many.length === MAX_PRODUCT_CATEGORIES, 'cap extras + primary');
assert(many.filter((r) => r.isPrimary).length === 1, 'exactly one primary');

console.log('product-category-membership.spec.ts OK');
