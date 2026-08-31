import { OUTBOX_EVENT_TYPES } from '../omnichannel/omnichannel.constants';
import type { OutboxEnqueueInput } from '../omnichannel/services/outbox.service';

type ProductSnapshot = {
  id: string;
  name?: string | null;
  description?: string | null;
  retailFullContent?: string | null;
  wholesaleFullContent?: string | null;
  status?: string | null;
  showOnRetail?: boolean | null;
  showOnWholesale?: boolean | null;
  wholesalePrice?: number | null;
  retailPrice?: number | null;
  wholesaleCompareAtPrice?: number | null;
  retailCompareAtPrice?: number | null;
  images?: string[] | null;
  videoUrl?: string | null;
};

function jsonEq(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function isVisible(p: ProductSnapshot, channel: 'RETAIL' | 'WHOLESALE'): boolean {
  if (String(p.status || '').toUpperCase() !== 'ACTIVE') return false;
  return channel === 'RETAIL' ? p.showOnRetail !== false : p.showOnWholesale !== false;
}

function push(
  events: OutboxEnqueueInput[],
  operationId: string,
  eventType: string,
  productId: string,
  channel: string | null,
  payload: Record<string, unknown>,
) {
  events.push({
    operationId,
    eventType,
    aggregateType: 'PRODUCT',
    aggregateId: productId,
    channel,
    payload: { productId, ...payload },
  });
}

/** Pure intents for product row + outbox in the same transaction. */
export function productOutboxIntents(
  before: ProductSnapshot | null,
  after: ProductSnapshot,
  operationId: string,
): OutboxEnqueueInput[] {
  const events: OutboxEnqueueInput[] = [];
  const id = after.id;

  if (!before) {
    push(events, operationId, OUTBOX_EVENT_TYPES.PRODUCT_CREATED, id, null, {});
  }

  if (before && (before.name !== after.name || before.description !== after.description)) {
    push(events, `${operationId}:content`, OUTBOX_EVENT_TYPES.PRODUCT_CONTENT_CHANGED, id, null, {});
  }
  if (before && before.retailFullContent !== after.retailFullContent) {
    push(events, `${operationId}:content:RETAIL`, OUTBOX_EVENT_TYPES.PRODUCT_CONTENT_CHANGED, id, 'RETAIL', {});
  }
  if (before && before.wholesaleFullContent !== after.wholesaleFullContent) {
    push(events, `${operationId}:content:WHOLESALE`, OUTBOX_EVENT_TYPES.PRODUCT_CONTENT_CHANGED, id, 'WHOLESALE', {});
  }

  const retailPriceChanged =
    !!before &&
    (before.retailPrice !== after.retailPrice || before.retailCompareAtPrice !== after.retailCompareAtPrice);
  const wholesalePriceChanged =
    !!before &&
    (before.wholesalePrice !== after.wholesalePrice ||
      before.wholesaleCompareAtPrice !== after.wholesaleCompareAtPrice);
  if (retailPriceChanged) {
    push(events, `${operationId}:price:RETAIL`, OUTBOX_EVENT_TYPES.PRODUCT_PRICE_CHANGED, id, 'RETAIL', {});
  }
  if (wholesalePriceChanged) {
    push(events, `${operationId}:price:WHOLESALE`, OUTBOX_EVENT_TYPES.PRODUCT_PRICE_CHANGED, id, 'WHOLESALE', {});
  }

  const mediaChanged = !!before && (!jsonEq(before.images, after.images) || before.videoUrl !== after.videoUrl);
  if (mediaChanged) {
    push(events, `${operationId}:media`, OUTBOX_EVENT_TYPES.PRODUCT_MEDIA_CHANGED, id, null, {});
  }

  for (const channel of ['RETAIL', 'WHOLESALE'] as const) {
    const was = before ? isVisible(before, channel) : false;
    const now = isVisible(after, channel);
    if (was !== now) {
      push(
        events,
        `${operationId}:vis:${channel}`,
        OUTBOX_EVENT_TYPES.PRODUCT_VISIBILITY_CHANGED,
        id,
        channel,
        { visible: now },
      );
    }
  }

  const anyVisible = (p: ProductSnapshot) => isVisible(p, 'RETAIL') || isVisible(p, 'WHOLESALE');
  if (before && anyVisible(before) && !anyVisible(after)) {
    push(events, `${operationId}:withdrawn`, OUTBOX_EVENT_TYPES.PRODUCT_WITHDRAWN, id, null, {});
  }

  push(events, `${operationId}:search`, OUTBOX_EVENT_TYPES.SEARCH_REINDEX_REQUESTED, id, null, {});
  return events;
}
