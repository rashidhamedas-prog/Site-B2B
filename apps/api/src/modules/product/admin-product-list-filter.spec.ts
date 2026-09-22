/**
 * npx ts-node --transpile-only src/modules/product/admin-product-list-filter.spec.ts
 */
import {
  UNCATEGORIZED_CATEGORY,
  inStockPredicate,
  parseCategoryListFilter,
  parseOptionalUuid,
} from './admin-product-list-filter';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const all = parseCategoryListFilter(undefined);
assert(all.kind === 'all', 'empty is all');
assert(parseCategoryListFilter('  ').kind === 'all', 'blank is all');
assert(parseCategoryListFilter('Uncategorized').kind === 'uncategorized', 'uncategorized token');
assert(UNCATEGORIZED_CATEGORY === 'uncategorized', 'token spelling');

const id = 'A0EEBC99-9C0B-4EF8-BB6D-6BB9BD380A11';
const parsed = parseCategoryListFilter(id);
assert(parsed.kind === 'id' && parsed.id === id.toLowerCase(), 'uuid lowercased');
assert(parseCategoryListFilter('شومیز').kind === 'invalid', 'name is not an id');
assert(parseCategoryListFilter("1' OR 1=1").kind === 'invalid', 'injection token rejected');

assert(parseOptionalUuid('') === null, 'empty collection');
assert(parseOptionalUuid('not-a-uuid') === 'invalid', 'bad collection');
assert(parseOptionalUuid(id) === id.toLowerCase(), 'collection uuid');

assert(inStockPredicate('retail') === 'p.retailStock > 0', 'retail stock');
assert(inStockPredicate('WHOLESALE') === 'p.wholesaleStock > 0', 'wholesale stock');
assert(
  inStockPredicate('') === '(p.retailStock > 0 OR p.wholesaleStock > 0)',
  'either channel',
);

console.log('admin-product-list-filter.spec.ts ok');
