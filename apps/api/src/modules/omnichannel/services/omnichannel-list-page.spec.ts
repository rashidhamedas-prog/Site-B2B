/**
 * npx ts-node --transpile-only src/modules/omnichannel/services/omnichannel-list-page.spec.ts
 */
import { normalizeListPageQuery, paginateItems } from './omnichannel-list-page';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

{
  const n = normalizeListPageQuery({});
  assert(n.page === 1 && n.limit === 20 && n.skip === 0, 'defaults');
  const capped = normalizeListPageQuery({ page: 2, limit: 99 });
  assert(capped.limit === 50 && capped.skip === 50, 'max 50 + page2 skip');
}

{
  const rows = Array.from({ length: 45 }, (_, i) => i + 1);
  const page1 = paginateItems(rows, 1, 20);
  assert(page1.items.length === 20 && page1.total === 45 && page1.items[0] === 1, 'page1');
  const page3 = paginateItems(rows, 3, 20);
  assert(page3.items.length === 5 && page3.items[0] === 41, 'page3 remainder');
}

console.log('omnichannel-list-page.spec.ts: ok');
