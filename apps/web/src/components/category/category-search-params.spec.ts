import assert from 'node:assert/strict';
import {
  buildCategoryProductsQuery,
  categoryPageQuery,
  categorySearchParamsFromURL,
  hasCategoryFilters,
  normalizeCategoryProducts,
} from './category-search-params';

assert.equal(hasCategoryFilters({}), false);
assert.equal(hasCategoryFilters({ page: '2' }), true);
assert.equal(hasCategoryFilters({ color: 'کرم' }), true);

assert.equal(categoryPageQuery({}, 1), '');
const pageQuery = new URLSearchParams(categoryPageQuery({ color: 'کرم' }, 2).slice(1));
assert.equal(pageQuery.get('color'), 'کرم');
assert.equal(pageQuery.get('page'), '2');

const fromUrl = categorySearchParamsFromURL(
  new URLSearchParams('color=کرم&page=2&utm_source=x'),
);
assert.deepEqual(fromUrl, { color: 'کرم', page: '2' });

const qs = buildCategoryProductsQuery('RETAIL', 'shomiz', { page: '2', color: 'کرم' });
const parsed = new URLSearchParams(qs);
assert.equal(parsed.get('channel'), 'RETAIL');
assert.equal(parsed.get('categorySlug'), 'shomiz');
assert.equal(parsed.get('page'), '2');
assert.equal(parsed.get('color'), 'کرم');
assert.equal(parsed.get('includeVariants'), null);

const wholesale = new URLSearchParams(
  buildCategoryProductsQuery('WHOLESALE', 'shomiz', {}),
);
assert.equal(wholesale.get('includeVariants'), '1');
assert.equal(wholesale.get('page'), '1');

assert.deepEqual(normalizeCategoryProducts([{ slug: 'a' }, { slug: 'b' }], {}), {
  data: [{ slug: 'a' }, { slug: 'b' }],
  meta: { page: 1, limit: 24, total: 2, totalPages: 1 },
});
assert.deepEqual(
  normalizeCategoryProducts(
    { data: [{ slug: 'a' }], meta: { page: 3, limit: 24, total: 50, totalPages: 3 } },
    { page: '3' },
  ),
  {
    data: [{ slug: 'a' }],
    meta: { page: 3, limit: 24, total: 50, totalPages: 3 },
  },
);
