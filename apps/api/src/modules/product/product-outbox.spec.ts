/**
 * npx ts-node --transpile-only src/modules/product/product-outbox.spec.ts
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { productOutboxIntents } from './product-outbox';
import { OUTBOX_EVENT_TYPES } from '../omnichannel/omnichannel.constants';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const base = {
  id: 'p1',
  name: 'مانتو',
  description: 'd',
  retailFullContent: 'r',
  wholesaleFullContent: 'w',
  status: 'ACTIVE',
  showOnRetail: true,
  showOnWholesale: true,
  wholesalePrice: 100,
  retailPrice: 200,
  wholesaleCompareAtPrice: null as number | null,
  retailCompareAtPrice: null as number | null,
  images: ['a.jpg'],
  videoUrl: null as string | null,
};

{
  const types = productOutboxIntents(null, base, 'op-create').map((e) => e.eventType);
  assert(types.includes(OUTBOX_EVENT_TYPES.PRODUCT_CREATED), 'create event');
  assert(types.includes(OUTBOX_EVENT_TYPES.SEARCH_REINDEX_REQUESTED), 'search on create');
  assert(types.filter((t) => t === OUTBOX_EVENT_TYPES.PRODUCT_VISIBILITY_CHANGED).length === 2, 'both channels visible on create');
}

{
  const types = productOutboxIntents(base, { ...base, name: 'جدید' }, 'op-u').map((e) => e.eventType);
  assert(types.includes(OUTBOX_EVENT_TYPES.PRODUCT_CONTENT_CHANGED), 'content');
  assert(!types.includes(OUTBOX_EVENT_TYPES.PRODUCT_PRICE_CHANGED), 'no price');
}

{
  const rows = productOutboxIntents(base, { ...base, retailPrice: 250 }, 'op-p');
  assert(rows.some((e) => e.eventType === OUTBOX_EVENT_TYPES.PRODUCT_PRICE_CHANGED && e.channel === 'RETAIL'), 'retail price');
  assert(!rows.some((e) => e.eventType === OUTBOX_EVENT_TYPES.PRODUCT_PRICE_CHANGED && e.channel === 'WHOLESALE'), 'wholesale isolated');
}

{
  const rows = productOutboxIntents(base, { ...base, wholesalePrice: 80 }, 'op-wprice');
  assert(rows.some((e) => e.eventType === OUTBOX_EVENT_TYPES.PRODUCT_PRICE_CHANGED && e.channel === 'WHOLESALE'), 'wholesale price');
  assert(!rows.some((e) => e.eventType === OUTBOX_EVENT_TYPES.PRODUCT_PRICE_CHANGED && e.channel === 'RETAIL'), 'retail isolated from wholesale price');
}

{
  const types = productOutboxIntents(base, { ...base, showOnRetail: false }, 'op-v').map((e) => e.eventType);
  assert(types.includes(OUTBOX_EVENT_TYPES.PRODUCT_VISIBILITY_CHANGED), 'visibility');
  assert(!types.includes(OUTBOX_EVENT_TYPES.PRODUCT_WITHDRAWN), 'still on wholesale');
}

{
  const types = productOutboxIntents(
    base,
    { ...base, showOnRetail: false, showOnWholesale: false },
    'op-w',
  ).map((e) => e.eventType);
  assert(types.includes(OUTBOX_EVENT_TYPES.PRODUCT_WITHDRAWN), 'withdrawn when both channels off');
}

{
  const a = productOutboxIntents(base, { ...base, name: 'x' }, 'op-1');
  const b = productOutboxIntents(base, { ...base, name: 'x' }, 'op-1');
  assert(a[0].operationId === b[0].operationId, 'same op id is stable');
}

{
  const service = readFileSync(resolve(__dirname, 'product.service.ts'), 'utf8');
  assert(service.includes('productOutboxIntents'), 'ProductService calls productOutboxIntents');
  assert(service.includes('enqueueMany'), 'ProductService enqueues via OutboxService');
  assert(!service.includes('this.search.'), 'ProductService has no request-path SearchService calls');
  assert(!service.includes('indexProduct'), 'ProductService does not index Meilisearch on the request');
}

console.log('product-outbox.spec.ts: ok');
