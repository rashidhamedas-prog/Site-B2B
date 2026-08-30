import { TOROB_PAGE_SIZE } from './torob-product-projection';
import { torobMaxPages } from './torob-product-request';
import { TOROB_REACHABILITY_BODY } from './torob-product-api.controller';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function paginate(total: number, page: number) {
  const items = Array.from({ length: total }, (_, i) => ({
    page_unique: `id-${String(i).padStart(3, '0')}`,
    date_added: '2026-01-01T00:00:00.000Z',
    date_updated: '2026-01-01T00:00:00.000Z',
  }));
  const ordered = [...items].sort((a, b) => a.page_unique.localeCompare(b.page_unique));
  const start = (page - 1) * TOROB_PAGE_SIZE;
  return {
    current_page: page,
    total,
    max_pages: torobMaxPages(total),
    products: ordered.slice(start, start + TOROB_PAGE_SIZE),
  };
}

for (const total of [0, 1, 99, 100, 101, 201]) {
  const first = paginate(total, 1);
  assert(first.total === total, `total ${total}`);
  assert(first.max_pages === (total === 0 ? 1 : Math.ceil(total / 100)), `max ${total}`);
  assert(first.products.length <= 100, 'page cap');
  if (total > 0 && total <= 100) assert(first.products.length === total, `len ${total}`);
  if (total === 101) {
    assert(first.products.length === 100, '101 p1');
    assert(paginate(total, 2).products.length === 1, '101 p2');
  }
  if (total === 201) {
    assert(paginate(total, 2).products.length === 100, '201 p2');
    assert(paginate(total, 3).products.length === 1, '201 p3');
  }
}

{
  const page = paginate(3, 1);
  const uniques = page.products.map((item) => item.page_unique);
  assert(uniques.join() === [...uniques].sort().join(), 'stable unique order');
}

assert(TOROB_REACHABILITY_BODY.api_version === 'torob_api_v3', 'reachability version');
assert(TOROB_REACHABILITY_BODY.total === 0, 'reachability empty');
assert(TOROB_REACHABILITY_BODY.max_pages === 1, 'reachability max_pages');
assert(Array.isArray(TOROB_REACHABILITY_BODY.products), 'reachability products');

console.log('torob-product-api.spec ok');
