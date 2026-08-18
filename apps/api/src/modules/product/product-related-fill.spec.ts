/**
 * npx ts-node --transpile-only src/modules/product/product-related-fill.spec.ts
 */
import {
  fillRelatedIds,
  MAX_RELATED_PRODUCTS,
  relatedVisibleOnChannel,
  scoreRelatedCandidate,
  sortRelatedCandidates,
  type RelatedCandidate,
} from './product-related-fill';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const source: RelatedCandidate = {
  id: 's',
  sku: 'SRC',
  status: 'ACTIVE',
  categoryId: 'cat-a',
  collectionId: 'col-1',
  fabricType: 'کتان',
  sizeType: 'TWO',
  showOnRetail: true,
  showOnWholesale: true,
};

const pool: RelatedCandidate[] = [
  { id: 's', sku: 'SRC', status: 'ACTIVE', categoryId: 'cat-a' },
  { id: 'd1', sku: 'B', status: 'ACTIVE', categoryId: 'cat-a', fabricType: 'کتان' },
  { id: 'd1', sku: 'DUP', status: 'ACTIVE', categoryId: 'cat-a' },
  { id: 'z-low', sku: 'Z', status: 'ACTIVE', categoryId: 'other' },
  { id: 'a-high', sku: 'A', status: 'ACTIVE', categoryId: 'cat-a', fabricType: 'کتان', collectionId: 'col-1' },
  { id: 'inactive', sku: 'X', status: 'ARCHIVED', categoryId: 'cat-a' },
  { id: 'hidden-r', sku: 'H', status: 'ACTIVE', categoryId: 'cat-a', showOnRetail: false, showOnWholesale: true },
];

assert(scoreRelatedCandidate(source, source) === -1, 'no self score');
assert(scoreRelatedCandidate(source, pool[5]) === -1, 'inactive excluded');

const ranked = sortRelatedCandidates(source, pool);
assert(ranked[0].id === 'a-high', `stable highest score first, got ${ranked[0].id}`);
assert(!ranked.some((r) => r.id === 's'), 'self removed');
assert(!ranked.some((r) => r.id === 'inactive'), 'inactive removed');

{
  const filled = fillRelatedIds('s', ['manual-1', 's', 'manual-1'], ranked, 5);
  assert(filled.kept[0] === 'manual-1', 'manual kept first');
  assert(!filled.next.includes('s'), 'self not stored');
  assert(filled.next.length <= MAX_RELATED_PRODUCTS, 'cap 5');
  assert(new Set(filled.next).size === filled.next.length, 'no duplicates');
}

{
  const onlyTwo = fillRelatedIds('s', [], [{ id: 'only-1', status: 'ACTIVE' }, { id: 'only-2', status: 'ACTIVE' }], 5);
  assert(onlyTwo.next.length === 2, 'fewer than 5 candidates kept as-is');
  assert(onlyTwo.shortfall === 3, 'shortfall reported');
}

{
  const first = fillRelatedIds('s', ['manual-1'], ranked, 5);
  const second = fillRelatedIds('s', first.next, ranked, 5);
  assert(JSON.stringify(first.next) === JSON.stringify(second.next), 'rerun is idempotent');
}

assert(relatedVisibleOnChannel(pool[6], 'RETAIL') === false, 'hidden on retail');
assert(relatedVisibleOnChannel(pool[6], 'WHOLESALE') === true, 'visible wholesale');

{
  const dry = fillRelatedIds('s', ['manual-1'], ranked, 5);
  assert(dry.added.length >= 1, 'fill adds shortage');
  assert(dry.kept.includes('manual-1'), 'dry-run planner preserves manual');
}

console.log('product-related-fill.spec.ts OK');
