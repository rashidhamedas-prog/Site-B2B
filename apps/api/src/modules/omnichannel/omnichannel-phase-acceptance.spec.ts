/**
 * Source gates for OMNICHANNEL-INFRASTRUCTURE phases 0–8.
 * npx ts-node --transpile-only src/modules/omnichannel/omnichannel-phase-acceptance.spec.ts
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function src(...parts: string[]) {
  return readFileSync(resolve(__dirname, '../..', ...parts), 'utf8');
}

const cms = src('modules/cms/cms.service.ts');
const db = src('config/database.config.ts');
const publicStatus = src('modules/product/public-product-status.ts');
const productSvc = src('modules/product/product.service.ts');
const productCtl = src('modules/product/product.controller.ts');
const order = src('modules/order/order.service.ts');
const storage = src('modules/upload/storage-delete.ts');
const schema = src('database/migrations/20260826-001-omnichannel-schema.ts');
const lease = src('modules/omnichannel/services/outbox-lease.ts');
const workerSrc = src('modules/omnichannel/services/outbox-worker.service.ts');
const worker = src('worker.main.ts');
const bale = src('modules/omnichannel/adapters/bale.adapter.ts');
const rubika = src('modules/omnichannel/adapters/rubika.adapter.ts');
const telegram = src('modules/omnichannel/adapters/telegram.adapter.ts');
const secrets = src('modules/omnichannel/omnichannel-secrets.ts');
const dbSync = src('config/db-sync.ts');
const storageSvc = src('modules/upload/storage.service.ts');
const mediaEntity = src('modules/omnichannel/entities/omnichannel-media-asset.entity.ts');
const checkout = readFileSync(
  resolve(__dirname, '../../../../web/src/app/checkout/page.tsx'),
  'utf8',
);

assert(cms.includes("channel: ch") && cms.includes('no cross-channel fallback'), 'CMS public lookup is channel-scoped');
assert(cms.includes('sanitizeCmsHtml'), 'CMS sanitizes HTML');
assert(db.includes('ReturnRequestAuditEntity'), 'RMA audit on runtime TypeORM');
assert(publicStatus.includes("PUBLIC_STATUS_FORBIDDEN"), 'public ALL rejected');
assert(productCtl.includes('resolvePublicProductStatus'), 'public list uses ACTIVE gate');
assert(productSvc.includes('productOutboxIntents'), 'product writes enqueue catalog outbox');
assert(productSvc.includes('enqueueMany'), 'product outbox uses the same OutboxService txn helper');
assert(!productSvc.includes('this.search.'), 'product request path does not call Meilisearch');
assert(!productSvc.includes('indexProduct'), 'product request path does not index Meilisearch');
assert(productCtl.includes('resolvePublicProductChannel'), 'public catalog requires RETAIL|WHOLESALE');
assert(productCtl.includes('inventoryService.setProductStock'), 'PATCH stock goes through inventory');
assert(order.includes("type: 'SALE'"), 'checkout writes SALE movement');
assert(storage.includes('sanitizeObjectKey'), 'media delete sanitizes keys');
assert(schema.includes('secretRef') && !/"secret"\s/.test(schema), 'schema stores secretRef only');
assert(lease.includes('FOR UPDATE SKIP LOCKED'), 'worker lease skips locked rows');
assert(lease.includes('"lockedAt" IS NULL'), 'PROCESSING without lockedAt is reclaimable');
assert(workerSrc.includes('timed out after'), 'hung outbox handler unsticks the worker loop');
assert(workerSrc.includes('this.beat()'), 'worker heartbeat advances during a batch');
assert(
  src('modules/notification/notification.service.ts').includes('AbortSignal.timeout'),
  'SMS fetch has a hard timeout',
);
assert(lease.includes('jitterRatio') && lease.includes('0.25'), 'retry backoff includes jitter');
assert(worker.includes('OMNICHANNEL_WORKER'), 'independent worker entry');
assert(bale.includes('ConnectorDisabledError') && rubika.includes('ConnectorDisabledError'), 'Bale/Rubika gated');
assert(telegram.includes('api.telegram.org'), 'Telegram official API');
assert(secrets.includes('TELEGRAM|BALE|RUBIKA'), 'secretRef allowlist');
assert(dbSync.includes('forbidden in production/staging'), 'DB_SYNC fail-closed');
assert(checkout.includes("channel: 'WHOLESALE'"), 'wholesale checkout sends channel');
assert(lease.includes("PRODUCT_STOCK_CHANGED"), 'worker leases product.stock_changed');
assert(lease.includes('PHASE4_EVENT_TYPES') && lease.includes('PRODUCT_CREATED'), 'catalog events leased for publication sync');
assert(lease.includes('BLOG_PUBLISHED') && lease.includes('CMS_PUBLISHED'), 'blog/cms events leased');
assert(src('modules/omnichannel/content-projection.ts').includes('channel_mismatch'), 'content projection is channel-scoped');
assert(workerSrc.includes('PRODUCT_STOCK_CHANGED'), 'worker handles stock_changed as reindex');
assert(mediaEntity.includes('omnichannel_media_assets') && mediaEntity.includes('altText'), 'media registry has alt');
assert(storageSvc.includes('mediaAssetRow') && storageSvc.includes('upsert'), 'upload registers media assets');
assert(storageSvc.includes('mediaAssetDeleteMatch'), 'object delete tombstones media registry rows');
assert(db.includes('OmnichannelMediaAssetEntity'), 'media registry on runtime TypeORM');

console.log('omnichannel-phase-acceptance.spec.ts: ok');
