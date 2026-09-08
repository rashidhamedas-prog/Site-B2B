/**
 * npx ts-node --transpile-only src/modules/product/product-ids-query.spec.ts
 */
import { merchandisingOrderSql, parseProductIdsQuery, PRODUCT_IDS_QUERY_MAX } from './product-ids-query';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const a = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const b = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

assert(parseProductIdsQuery(`${a},${b} ${a}`).join(',') === `${a},${b}`, 'dedupe comma/space');
assert(parseProductIdsQuery('coming-soon;drop table').length === 0, 'reject non-uuid');
assert(parseProductIdsQuery([a, 'nope', b])[0] === a, 'array input');
assert(parseProductIdsQuery(null).length === 0, 'null is empty');

const many = Array.from({ length: 20 }, (_, i) => `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa${String(i).padStart(2, '0')}`);
assert(parseProductIdsQuery(many.join(',')).length === PRODUCT_IDS_QUERY_MAX, 'cap 16');

const { sql, params } = merchandisingOrderSql('p', [a, b]);
assert(sql.includes('CASE p.id'), 'case order');
assert(sql.includes(':moid0'), 'bound params');
assert(!sql.includes(a), 'uuid not inlined');
assert(params.moid0 === a && params.moid1 === b, 'param map');

console.log('product-ids-query.spec.ts ok');
