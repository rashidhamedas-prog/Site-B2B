/**
 * npx tsx apps/web/src/components/admin/admin-omnichannel-outbox-label.spec.ts
 */
import {
  isChannelPublishEventType,
  isOutboxRowForConfiguredChannels,
  outboxChannelCellLabel,
} from './admin-omnichannel-outbox';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(!isChannelPublishEventType('sales_partner.profile.status_changed'), 'sp not channel publish');
assert(outboxChannelCellLabel('sales_partner.profile.status_changed', 'RETAIL') === 'همکار', 'sp never تکی');
assert(outboxChannelCellLabel('customer.approved.marketing', 'WHOLESALE') === 'پیامک', 'marketing domain');
assert(outboxChannelCellLabel('search.reindex.requested', null) === 'سیستم', 'search domain');
assert(outboxChannelCellLabel('product.created', 'WHOLESALE') === 'عمده', 'publish wholesale');
assert(outboxChannelCellLabel('product.price_changed', 'RETAIL') === 'تکی', 'publish retail');

const wholesaleOnly = new Set(['WHOLESALE']);
assert(
  !isOutboxRowForConfiguredChannels('sales_partner.application.submitted', 'RETAIL', wholesaleOnly),
  'sp hidden in channel scope',
);
assert(
  !isOutboxRowForConfiguredChannels('product.price_changed', 'RETAIL', wholesaleOnly),
  'retail publish hidden when only wholesale bots',
);
assert(
  isOutboxRowForConfiguredChannels('product.price_changed', 'WHOLESALE', wholesaleOnly),
  'wholesale publish kept',
);
assert(
  isOutboxRowForConfiguredChannels('product.created', null, wholesaleOnly),
  'unscoped product event kept',
);

console.log('admin-omnichannel-outbox-label.spec.ts OK');
