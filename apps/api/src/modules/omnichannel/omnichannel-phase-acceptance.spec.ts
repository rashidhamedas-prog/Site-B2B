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
const cmsCtl = src('modules/cms/cms.controller.ts');
const blog = src('modules/blog/blog.service.ts');
const blogCtl = src('modules/blog/blog.controller.ts');
const blogExtras = src('modules/blog/blog-extras.service.ts');
const collectionCtl = src('modules/collection/collection.controller.ts');
const collectionSvc = src('modules/collection/collection.service.ts');
const discountSvc = src('modules/discount/discount.service.ts');
const discountCtl = src('modules/discount/discount.controller.ts');
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
const oosPolicy = src('modules/omnichannel/oos-policy.ts');
const omniSvc = src('modules/omnichannel/services/omnichannel.service.ts');
const omniAdmin = src('modules/omnichannel/controllers/omnichannel-admin.controller.ts');
const adminOmni = readFileSync(
  resolve(__dirname, '../../../../web/src/components/admin/AdminOmnichannel.tsx'),
  'utf8',
);
const adminOmniUi = readFileSync(
  resolve(__dirname, '../../../../web/src/components/admin/admin-omnichannel-ui.tsx'),
  'utf8',
);
const dbSync = src('config/db-sync.ts');
const storageSvc = src('modules/upload/storage.service.ts');
const mediaEntity = src('modules/omnichannel/entities/omnichannel-media-asset.entity.ts');
const checkout = readFileSync(
  resolve(__dirname, '../../../../web/src/app/checkout/page.tsx'),
  'utf8',
);

assert(cms.includes("channel: ch") && cms.includes('requirePublicCmsChannel'), 'CMS public lookup requires RETAIL|WHOLESALE');
assert(cms.includes('sanitizeCmsHtml'), 'CMS sanitizes HTML');
assert(cmsCtl.includes('کانال نامعتبر است'), 'public CMS missing channel is 400');
assert(blog.includes('requirePublicBlogChannel'), 'blog public lookup requires RETAIL|WHOLESALE');
assert(blogCtl.includes('requirePublicBlogChannel') && blogCtl.includes('کانال نامعتبر است'), 'public blog missing channel is 400');
assert(blogCtl.includes("searchPublic(") && !blogCtl.includes("@Query('channel') channel = 'WHOLESALE',\n    @Query('page')"), 'public blog search does not default WHOLESALE');
assert(blogCtl.includes("async feed(@Query('channel') channel?: string"), 'public blog feed does not default WHOLESALE');
assert(blogCtl.includes("sitemapPosts(@Query('channel') channel?: string)"), 'public blog sitemap does not default WHOLESALE');
assert(blogCtl.includes("postSeo(@Param('slug') slug: string, @Query('channel') channel?: string)"), 'public blog seo does not default WHOLESALE');
assert(collectionCtl.includes('resolvePublicProductChannel') && collectionCtl.includes('کانال نامعتبر است'), 'public collections require channel');
assert(collectionSvc.includes('channel && row.channel !== channel'), 'collection slug/id match requested channel');
assert(discountSvc.includes('requireDiscountChannel') && discountSvc.includes('discountAppliesToChannel'), 'discount validate is channel-scoped');
assert(order.includes('requireDiscountChannel') && order.includes('ch === \'WHOLESALE\'') && order.includes('applyTiered') && order.includes('applySide'), 'quote discounts skip wholesale automatics on retail');
assert(discountCtl.includes('body.channel'), 'public discount validate accepts channel');
assert(blogExtras.includes('channelAvailability') && !/stock:\s*p\.stock/.test(blogExtras), 'blog related products use channel stock');
assert(blogCtl.includes('requirePublicBlogChannel(channel)') && blogCtl.includes('relatedProducts'), 'blog related products require channel');
assert(blogCtl.includes('getAuthor(') && blogCtl.includes("authors/:slug") && blogCtl.includes('getAuthorBySlug(slug, channel)'), 'public author page requires channel');
assert(blogExtras.includes('status: \'PUBLISHED\', channel: ch'), 'author posts are channel-scoped');
assert(oosPolicy.includes('autoPublishEventTypesChosen') && oosPolicy.includes('effectiveWorkerRetentionDays'), '§9 leftovers stored with chosen flags');
assert(!workerSrc.includes('effectiveWorkerRetrySlaSeconds') && !workerSrc.includes('effectiveWorkerRetentionDays'), 'worker is not wired to leftover settings');
assert(adminOmni.includes('autoPublishEventTypes') && adminOmni.includes('outboxRetentionDays'), 'admin leftover settings');
assert(adminOmni.includes('هنوز انتشاری ثبت نشده') && adminOmni.includes('رویدادی در صف نیست'), 'admin empty states');
{
  const tables = (adminOmni.match(/<table\b/g) || []).length;
  const heads = (adminOmni.match(/<thead>/g) || []).length;
  assert(tables >= 3 && heads === tables, 'admin tables have headers');
}
assert(adminOmni.includes('autoPublishMode') && adminOmni.includes('withdrawAction') && adminOmni.includes('/verify'), 'admin console v2: automation mode, withdraw action, destination verify');
assert(
  adminOmni.includes('selectedDestinationId')
    && (adminOmni.includes('destinations/') && adminOmni.includes('publish-settings')),
  'admin console: destination-scoped publish rules UI',
);
assert(
  omniSvc.includes('patchDestinationPublishSettings')
    && omniSvc.includes('resolveDestinationPublishSettings')
    && omniSvc.includes('automationCountersForDestination'),
  'per-destination publish settings + automation isolation',
);
assert(
  omniSvc.includes('دیگر روی ربات ذخیره نمی‌شود')
    && omniAdmin.includes('منسوخ'),
  'connection publish-settings write is deprecated / blocked',
);
assert(
  omniAdmin.includes('scopedPublish') || omniSvc.includes('scopedPublish'),
  'status diagnosis exposes destination-scoped publish metrics',
);
assert(
  omniAdmin.includes('destinations/:id/publish-settings'),
  'admin API exposes per-destination publish-settings',
);
assert(
  src('modules/omnichannel/destination-publish-settings.ts').includes('resolveDestinationPublishSettings'),
  'destination publish settings module',
);
assert(
  src('database/migrations/20261024-001-destination-publish-settings.ts').includes('publishSettings')
    && src('database/migrations/20261024-001-destination-publish-settings.ts').includes('destinationId'),
  'migration adds destination publishSettings + template destinationId',
);
assert(
  omniSvc.includes('private async publicationPayloadFor(')
    && omniSvc.includes('destinationId?: string')
    && omniSvc.includes('automationCountersForDestination'),
  'publicationPayloadFor + per-destination counters',
);
assert(omniAdmin.includes("outbox/clear-waiting") && omniAdmin.includes('publications/requeue-by-category'), 'admin clear-waiting and category requeue routes');
assert(omniAdmin.includes('outbox/revive-connector-disabled') && omniSvc.includes('reviveConnectorDisabledDead'), 'admin revive connector-disabled DEAD');
assert(
  omniAdmin.includes('OmnichannelMinRole')
    && omniAdmin.includes('RequiresGoRef')
    && omniAdmin.includes('OmnichannelOwnerWhenLive')
    && omniAdmin.includes('OmnichannelRoleGuard'),
  'PR-6 role decorators + OmnichannelRoleGuard on admin controller',
);
assert(
  omniAdmin.includes("requeue-by-category")
    && omniAdmin.includes("OmnichannelOwnerWhenLive")
    && omniAdmin.includes("Put('secrets')")
    && omniAdmin.includes('@RequiresGoRef()')
    && omniAdmin.includes("outbox/clear-waiting")
    && omniAdmin.includes('reapproveDelivery'),
  'PR-6 Owner+goRef on requeue-live / secrets / clear-waiting / reapprove',
);
assert(
  omniSvc.includes('assertGoRefPresent')
    && omniSvc.includes('goRef')
    && omniSvc.includes('redactAuditPayloadSummary')
    && omniSvc.includes('connection_create')
    && omniSvc.includes('template_create'),
  'PR-6 audit goRef/source and previously silent CRUD',
);
assert(
  src('modules/omnichannel/omnichannel-rbac.ts').includes('OMNICHANNEL_RBAC_ENABLED')
    && src('database/migrations/20261028-002-omnichannel-audit-rbac.ts').includes('append_only'),
  'PR-6 RBAC flag + append-only migration',
);
assert(workerSrc.includes('isConnectorDisabledError') && workerSrc.includes('DeliveryDeferredError'), 'worker defers connector-disabled instead of DEAD');
assert(omniSvc.includes('clearWaitingOutbox') && omniSvc.includes('requeueByCategory'), 'service clear-waiting and category requeue');
assert(
  omniSvc.includes('countCreatesTowardDailyCap')
    && omniSvc.includes('remainingDailyCreates')
    && omniSvc.includes('سقف پست جدید امروز پر است'),
  'daily CREATE cap covers manual + category blast, not only auto=true',
);
assert(
  src('modules/omnichannel/publication-automation.ts').includes('remainingDailyCreates'),
  'remainingDailyCreates helper exported for cap math',
);
assert(
  omniSvc.includes('stale WITHDRAWN sibling must not')
    && workerSrc.includes('publication deliver missing destination'),
  'publish silence fix: requeue reopens withdrawn; worker fails missing dest',
);
{
  const constants = src('modules/omnichannel/omnichannel.constants.ts');
  assert(
    constants.includes("'WITHDRAWN'")
      && /DELIVERY_STATUSES[\s\S]*WITHDRAWN/.test(constants),
    'PR-7 delivery status WITHDRAWN',
  );
  assert(
    omniAdmin.includes('deliveries/:deliveryId/delete-plan')
      && omniAdmin.includes('deliveries/:deliveryId/messages/delete')
      && omniAdmin.includes('deliveries/:deliveryId/edit')
      && omniAdmin.includes('deliveries/:deliveryId/revert'),
    'PR-7 delete-plan / delete / edit / revert routes',
  );
  assert(
    omniSvc.includes('onRemoteDeleteSucceeded')
      && workerSrc.includes('onRemoteDeleteSucceeded'),
    'PR-7 worker marks WITHDRAWN after DELETE',
  );
  assert(
    src('modules/omnichannel/services/omnichannel-delete.service.ts').includes('withdrawPublication')
      && omniSvc.includes('deleteService.withdrawPublication'),
    'PR-7 withdraw reuses backup+delete pipeline',
  );
  assert(
    src('database/migrations/20261028-003-omnichannel-post-backup.ts').includes('omnichannel_post_backups'),
    'PR-7 post_backup migration',
  );
}
assert(
  src('modules/omnichannel/publication-automation.ts').includes('Orphan heal'),
  'stock_changed heals orphan DRAFT under OOS DELETE',
);
assert(adminOmni.includes('خالی کردن صف انتظار') && adminOmni.includes('شروع ارسال دسته'), 'admin UI clear queue and category requeue');
assert(omniAdmin.includes("Delete('connections/:id')") && omniAdmin.includes("Delete('destinations/:id')"), 'admin can delete connections and destinations');
assert(omniSvc.includes('deleteConnection') && omniSvc.includes('deleteDestination'), 'service deletes connection/destination after detaching deliveries');
assert(adminOmni.includes('conn-del-') && adminOmni.includes('dest-del-') && adminOmni.includes('apiClient.delete(`/omnichannel/connections/${row.id}`)'), 'admin has delete buttons for bots and channels');
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
  src('modules/omnichannel/services/outbox.service.ts').includes('MARK_DONE_SQL') &&
    src('modules/omnichannel/services/outbox.service.ts').includes('this.dataSource.query(MARK_DONE_SQL'),
  'markDone persists with raw SQL like lease',
);
assert(
  src('modules/omnichannel/services/outbox.service.ts').includes('this.dataSource.query(MARK_FAILURE_SQL'),
  'markFailure persists with raw SQL like lease',
);
assert(
  src('modules/omnichannel/services/outbox.service.ts').includes('leaseRowsFromQueryResult'),
  'leaseBatch unwraps TypeORM UPDATE RETURNING tuple',
);
assert(
  src('modules/notification/sms-transport.ts').includes('AbortSignal.timeout'),
  'SMS fetch has a hard timeout',
);
assert(lease.includes('jitterRatio') && lease.includes('0.25'), 'retry backoff includes jitter');
assert(worker.includes('OMNICHANNEL_WORKER'), 'independent worker entry');
assert(bale.includes('ConnectorDisabledError') && rubika.includes('ConnectorDisabledError'), 'Bale/Rubika gated');
assert(bale.includes('isOmnichannelProviderEnabled') && rubika.includes('isOmnichannelProviderEnabled'), 'Bale/Rubika honour per-provider kill switch');
assert(telegram.includes('api.telegram.org'), 'Telegram official API');
assert(telegram.includes('TELEGRAM_API_URL'), 'Telegram base URL is env-overridable');
assert(bale.includes('https://tapi.bale.ai') && !bale.includes('parse_mode'), 'Bale official API, Markdown-only (no parse_mode)');
assert(rubika.includes('https://botapi.rubika.ir/v3') && rubika.includes('meta_data_parts') && rubika.includes('requestSendFile'), 'Rubika official API v3 (metadata + upload flow)');
assert(!rubika.includes('sendMediaGroup') && !rubika.includes('button_link'), 'Rubika: no invented album/button-url API');
assert(secrets.includes('TELEGRAM|BALE|RUBIKA'), 'secretRef allowlist');
{
  const vault = src('modules/omnichannel/omnichannel-token-vault.ts');
  const vaultSvc = src('modules/omnichannel/services/omnichannel-token-vault.service.ts');
  assert(vault.includes('aes-256-gcm') && vault.includes('omnichannel.secret.vault'), 'tokens encrypted in dedicated vault key');
  assert(vault.includes('isProductionLike') && vault.includes('vault_key_missing'), 'production requires OMNICHANNEL_VAULT_KEY');
  assert(vault.includes('setAAD'), 'GCM binds secretRef as AAD');
  assert(vaultSvc.includes('pessimistic_write') && vaultSvc.includes('applyVaultOverlay({})'), 'vault persist locks; missing key clears overlay');
  assert(omniSvc.includes('probeCredential') && !omniSvc.includes('if (isOmnichannelProviderEnabled(provider))'), 'getMe before persist even when provider gated');
  assert(omniAdmin.includes("Put('secrets')") && omniAdmin.includes('putSecret'), 'write-only token endpoint');
  assert(omniSvc.includes('assertNoVaultLeak') && omniSvc.includes('secret_put'), 'save path audits without ciphertext');
  assert(adminOmni.includes('type={reveal ? \'text\' : \'password\'}') || adminOmni.includes('WriteOnlySecretField'), 'admin token field is write-only');
  assert(adminOmni.includes('ProviderTokenVault') && adminOmniUi.includes('omni-bot-token-${info.provider}'), 'one write-only token field per provider');
  assert(adminOmni.includes('/omnichannel/secrets'), 'admin posts token only to dedicated secrets route');
  assert(!adminOmni.includes('توکن هیچ‌وقت وارد مرورگر نمی‌شود'), 'copy no longer claims the token never enters the browser');
}
assert(secrets.includes('isCanary'), 'public destination exposes isCanary only');
assert(oosPolicy.includes('resolveOosDecision') && oosPolicy.includes('selectCanaryDestinations'), 'oos helper');
assert(omniSvc.includes('selectCanaryDestinations'), 'enqueue targets canary only');
assert(omniSvc.includes('ChannelAdapterRegistry') && !omniSvc.includes("provider !== 'TELEGRAM'"), 'service is provider-generic via registry');
assert(workerSrc.includes('ChannelAdapterRegistry') && !workerSrc.includes('TelegramAdapter'), 'worker resolves adapter from registry');
assert(omniAdmin.includes('getSettings') && omniAdmin.includes('patchSettings'), 'admin settings endpoints');
assert(adminOmni.includes('retailOosPolicy') && adminOmni.includes('isCanary'), 'admin OOS radios and canary picker');
assert(adminOmni.includes('AttentionStrip') && adminOmniUi.includes('AttentionStrip'), 'admin AttentionStrip for actionable warnings');
assert(adminOmni.includes("وضعیت و اقدام") && adminOmni.includes("تنظیمات"), 'admin tabs status/settings IA');
assert(adminOmni.includes('مقصد آزمایشی') && !adminOmni.includes('مقصد تست (canary)'), 'canary jargon removed from primary UI');
assert(omniSvc.includes('diagnoseGateBlock') && omniAdmin.includes('gateBlockReason'), 'status exposes gateBlockReason diagnosis');
assert(omniSvc.includes('outboxDeadByEventType') && omniAdmin.includes('outboxDeadByEventType'), 'status exposes dead-by-eventType');
assert(lease.includes('SALES_PARTNER_OUTBOX_EVENT_TYPES') || lease.includes('sales_partner.'), 'sales_partner ACK leased');
assert(workerSrc.includes('sales_partner.'), 'worker ACKs sales_partner domain events');
assert(adminOmni.includes('outboxChannelCellLabel') || adminOmniUi.includes('outboxChannelCellLabel'), 'UI domain channel labels');
assert(adminOmni.includes('isOutboxRowForConfiguredChannels') || adminOmniUi.includes('isOutboxRowForConfiguredChannels'), 'UI filters by configured bots');
assert(src('modules/omnichannel/gate-block-reason.ts').includes('resolveGateBlockReason'), 'gate-block-reason helper');
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

/* --- PR-8 coverage matrix (read-mostly; UI behind flag) --- */
{
  const coverageSvc = src('modules/omnichannel/services/omnichannel-coverage.service.ts');
  const coverageMatrix = src('modules/omnichannel/coverage-matrix.ts');
  const constants = src('modules/omnichannel/omnichannel.constants.ts');
  assert(omniAdmin.includes("Get('coverage')") && omniAdmin.includes("Get('coverage/duplicates')"), 'coverage list + duplicates routes');
  assert(omniAdmin.includes("Post('coverage/out-of-panel/ingest')") && omniAdmin.includes("Put('coverage/:productId/absence-reason')"), 'coverage ingest + absence');
  assert(omniAdmin.includes("@OmnichannelMinRole('VIEWER')") && omniAdmin.includes('listCoverage'), 'coverage reads VIEWER+');
  assert(omniAdmin.includes('coverageUi') && constants.includes('OMNICHANNEL_COVERAGE_UI'), 'coverage UI flag default-gated');
  assert(coverageSvc.includes('selectFilteredProductPage') && coverageSvc.includes('LIMIT :limit OFFSET :offset'), 'SQL-level coverage pagination');
  assert(coverageSvc.includes('selectDuplicatePairs') && coverageSvc.includes('loadDeliveryMessageIds'), 'SQL duplicates + delivery_messages');
  assert(coverageSvc.includes("payload->>'productId'") && coverageMatrix.includes('resolveTrailMessageIds'), 'oop by productId + message id prefer delivery_messages');
  assert(adminOmni.includes('AdminOmnichannelCoverage') || adminOmni.includes('پوشش و تکرار'), 'admin coverage tab mount');
}

/* --- PR-9 composer (wizard behind flag; dry-run loads liveRemote, zero adapters) --- */
{
  const composerPlan = src('modules/omnichannel/composer-plan.ts');
  const composerSvc = src('modules/omnichannel/services/omnichannel-composer.service.ts');
  const constants = src('modules/omnichannel/omnichannel.constants.ts');
  assert(omniAdmin.includes("Get('composer/products')") && omniAdmin.includes("Post('composer/plan')"), 'composer routes');
  assert(omniAdmin.includes('composerUi') && constants.includes('OMNICHANNEL_COMPOSER_UI'), 'composer UI flag default-gated');
  assert(composerPlan.includes('buildComposerPlan') && composerPlan.includes('pending_create'), 'pure plan CREATE/UPDATE/SKIP');
  assert(composerSvc.includes('loadComposerDedupeContext') && !composerSvc.includes('TelegramAdapter'), 'plan loads liveRemote without adapters');
  assert(omniSvc.includes('plan: composerPlan') && omniSvc.includes('liveRemote = await this.liveRemoteMessages'), 'createPublication dry-run returns plan with liveRemote');
  assert(adminOmni.includes('AdminOmnichannelComposer') || adminOmni.includes('انتشار جدید'), 'admin composer tab mount');
  assert(!composerPlan.includes('TELEGRAM_API_URL') && !composerSvc.includes('TELEGRAM_API_URL'), 'no PR-12 egress in composer');
}

console.log('omnichannel-phase-acceptance.spec.ts: ok');
