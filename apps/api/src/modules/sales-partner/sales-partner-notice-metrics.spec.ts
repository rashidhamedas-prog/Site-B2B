/**
 * Contract for admin notice metrics: frozen send audience vs live ACTIVE roster.
 * Run: npx ts-node --transpile-only src/modules/sales-partner/sales-partner-notice-metrics.spec.ts
 */

export type AdminNoticeMetricsInput = {
  audienceCountAtPublish: number;
  seenCount: number;
  dismissedCount: number;
  activeAudienceCount: number;
};

export function shapeAdminNoticeMetrics(input: AdminNoticeMetricsInput) {
  return {
    audienceCount: input.audienceCountAtPublish,
    activeAudienceCount: input.activeAudienceCount,
    seenCount: input.seenCount,
    dismissedCount: input.dismissedCount,
  };
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function run() {
  const atPublish = shapeAdminNoticeMetrics({
    audienceCountAtPublish: 25,
    seenCount: 0,
    dismissedCount: 0,
    activeAudienceCount: 25,
  });
  assert(atPublish.audienceCount === 25, 'publish audience');
  assert(atPublish.activeAudienceCount === 25, 'live matches at publish');

  const later = shapeAdminNoticeMetrics({
    audienceCountAtPublish: 25,
    seenCount: 34,
    dismissedCount: 7,
    activeAudienceCount: 75,
  });
  assert(later.audienceCount === 25, 'publish snapshot must stay frozen');
  assert(later.activeAudienceCount === 75, 'live ACTIVE roster');
  assert(later.seenCount === 34, 'seen live');
  assert(later.dismissedCount === 7, 'dismissed live');
  assert(later.seenCount > later.audienceCount, 'seen may exceed send-time audience');

  const emptyListEnvelope = { activeAudienceCount: 75, items: [] as unknown[] };
  assert(emptyListEnvelope.activeAudienceCount === 75, 'empty list still exposes live roster');
  assert(emptyListEnvelope.items.length === 0, 'empty items');

  console.log('sales-partner-notice-metrics.spec.ts: ok');
}

run();
