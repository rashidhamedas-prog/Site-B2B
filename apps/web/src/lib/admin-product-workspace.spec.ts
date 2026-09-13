/**
 * npx ts-node --transpile-only src/lib/admin-product-workspace.spec.ts
 */
import assert from 'node:assert/strict';
import {
  isProductListChannel,
  parseProductWorkspaceQuery,
  serializeProductWorkspaceQuery,
  productListApiChannel,
  PRODUCT_CHANNEL_LABEL,
} from './admin-product-workspace.ts';

assert.equal(isProductListChannel('ALL'), true);
assert.equal(isProductListChannel('retail'), false);
assert.equal(PRODUCT_CHANNEL_LABEL.ALL, 'کامل');

assert.deepEqual(parseProductWorkspaceQuery({ get: () => null }), {
  channel: 'ALL',
  section: 'identity',
  q: '',
});

assert.deepEqual(
  parseProductWorkspaceQuery({
    get: (name: string) =>
      name === 'channel' ? 'retail' : name === 'section' ? 'SEO' : name === 'q' ? ' سارا ' : null,
  }),
  { channel: 'RETAIL', section: 'seo', q: 'سارا' },
);

assert.equal(serializeProductWorkspaceQuery({ channel: 'ALL' }), '');
assert.equal(
  serializeProductWorkspaceQuery({ channel: 'WHOLESALE', section: 'media', q: 'لینن' }),
  'channel=WHOLESALE&section=media&q=%D9%84%DB%8C%D9%86%D9%86',
);
assert.equal(productListApiChannel('ALL'), undefined);
assert.equal(productListApiChannel('RETAIL'), 'RETAIL');

console.log('admin-product-workspace.spec.ts ok');
