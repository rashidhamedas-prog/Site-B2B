/**
 * npx tsx src/lib/admin-product-workspace.spec.ts
 */
import assert from 'node:assert/strict';
import {
  UNCATEGORIZED_CATEGORY,
  isAdminCategoryUuid,
  isProductListChannel,
  parseProductWorkspaceQuery,
  productListApiChannel,
  productListFilterChips,
  productListFilterCount,
  productListIsNarrowed,
  serializeProductWorkspaceQuery,
  PRODUCT_CHANNEL_LABEL,
} from './admin-product-workspace.ts';

assert.equal(isProductListChannel('ALL'), true);
assert.equal(isProductListChannel('retail'), false);
assert.equal(PRODUCT_CHANNEL_LABEL.ALL, 'کامل');

const empty = {
  channel: 'ALL' as const,
  section: 'identity' as const,
  q: '',
  categoryId: '',
  status: 'ALL' as const,
  collectionId: '',
  inStock: false,
};

assert.deepEqual(parseProductWorkspaceQuery({ get: () => null }), empty);

const categoryId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
assert.deepEqual(
  parseProductWorkspaceQuery({
    get: (name: string) =>
      name === 'channel'
        ? 'retail'
        : name === 'section'
          ? 'SEO'
          : name === 'q'
            ? ' سارا '
            : name === 'categoryId'
              ? categoryId.toUpperCase()
              : name === 'status'
                ? 'archived'
                : name === 'collectionId'
                  ? 'not-uuid'
                  : name === 'inStock'
                    ? '1'
                    : null,
  }),
  {
    channel: 'RETAIL',
    section: 'seo',
    q: 'سارا',
    categoryId,
    status: 'ARCHIVED',
    collectionId: '',
    inStock: true,
  },
);

assert.equal(
  parseProductWorkspaceQuery({
    get: (name: string) => (name === 'categoryId' ? 'Uncategorized' : null),
  }).categoryId,
  UNCATEGORIZED_CATEGORY,
);
assert.equal(
  parseProductWorkspaceQuery({
    get: (name: string) => (name === 'categoryId' ? 'شومیز' : null),
  }).categoryId,
  '',
);
assert.equal(isAdminCategoryUuid(categoryId), true);
assert.equal(isAdminCategoryUuid(UNCATEGORIZED_CATEGORY), false);

assert.equal(serializeProductWorkspaceQuery({ channel: 'ALL' }), '');
assert.equal(
  serializeProductWorkspaceQuery({ channel: 'WHOLESALE', section: 'media', q: 'لینن' }),
  'channel=WHOLESALE&section=media&q=%D9%84%DB%8C%D9%86%D9%86',
);
assert.equal(
  serializeProductWorkspaceQuery({
    channel: 'ALL',
    categoryId: UNCATEGORIZED_CATEGORY,
    status: 'ACTIVE',
    inStock: true,
    collectionId: 'nope',
  }),
  'categoryId=uncategorized&status=ACTIVE&inStock=1',
);
assert.equal(productListApiChannel('ALL'), undefined);
assert.equal(productListApiChannel('RETAIL'), 'RETAIL');

const narrowed = parseProductWorkspaceQuery({
  get: (name: string) => (name === 'categoryId' ? UNCATEGORIZED_CATEGORY : null),
});
assert.equal(productListFilterCount(narrowed), 1);
assert.equal(productListIsNarrowed(narrowed), true);
assert.equal(productListIsNarrowed(empty), false);
assert.deepEqual(productListFilterChips(narrowed), [
  { key: 'categoryId', label: 'بدون دسته‌بندی' },
]);
assert.deepEqual(
  productListFilterChips(
    { ...empty, categoryId, collectionId: categoryId, status: 'ACTIVE', inStock: true },
    { categoryName: 'شومیز', collectionName: 'پاییز' },
  ).map((chip) => chip.label),
  ['دسته: شومیز', 'وضعیت: فعال', 'کالکشن: پاییز', 'فقط موجود'],
);

console.log('admin-product-workspace.spec.ts ok');
