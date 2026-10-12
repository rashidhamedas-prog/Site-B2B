/** Pure outbox display/filter helpers (no React) for the publish console. */

/** Messenger / catalog outbox events (excludes SMS, search, marketing noise). */
export function isChannelPublishEventType(eventType: string) {
  const t = String(eventType || '');
  return t.startsWith('product.') || t.startsWith('blog.') || t.startsWith('cms.') || t.startsWith('publication.');
}

export function channelLabel(channel?: string | null) {
  return channel === 'WHOLESALE' ? 'عمده' : channel === 'RETAIL' ? 'تکی' : channel || '—';
}

/**
 * Column «کانال»: تکی/عمده only for messenger/catalog events.
 * Other shared-outbox domains get a domain label (not a Telegram destination).
 */
export function outboxChannelCellLabel(eventType: string, channel?: string | null) {
  if (!isChannelPublishEventType(eventType)) {
    const t = String(eventType || '');
    if (t.startsWith('sales_partner.')) return 'همکار';
    if (t.startsWith('customer.') || t.startsWith('marketing.')) return 'پیامک';
    if (
      t.startsWith('search.')
      || t.startsWith('order.')
      || t.startsWith('fulfillment.')
      || t.startsWith('affiliate.')
    ) {
      return 'سیستم';
    }
    return '—';
  }
  return channelLabel(channel);
}

/** Keep channel-scope queue aligned with bots the admin actually registered. */
export function isOutboxRowForConfiguredChannels(
  eventType: string,
  channel: string | null | undefined,
  configured: ReadonlySet<string>,
) {
  if (!isChannelPublishEventType(eventType)) return false;
  if (!channel) return true;
  if (configured.size === 0) return true;
  return configured.has(String(channel).toUpperCase());
}
