import { areOmnichannelConnectorsEnabled, OUTBOX_EVENT_TYPES } from '../omnichannel.constants';

export const PHASE3_EVENT_TYPES = [
  OUTBOX_EVENT_TYPES.SEARCH_REINDEX_REQUESTED,
  OUTBOX_EVENT_TYPES.PRODUCT_STOCK_CHANGED,
  OUTBOX_EVENT_TYPES.ORDER_CREATED_NOTIFICATION,
  OUTBOX_EVENT_TYPES.ORDER_STATUS_CHANGED_NOTIFICATION,
  OUTBOX_EVENT_TYPES.AFFILIATE_POSTBACK_REQUESTED,
] as const;

export const PHASE4_EVENT_TYPES = [
  OUTBOX_EVENT_TYPES.PRODUCT_CREATED,
  OUTBOX_EVENT_TYPES.PRODUCT_CONTENT_CHANGED,
  OUTBOX_EVENT_TYPES.PRODUCT_PRICE_CHANGED,
  OUTBOX_EVENT_TYPES.PRODUCT_VISIBILITY_CHANGED,
  OUTBOX_EVENT_TYPES.PRODUCT_MEDIA_CHANGED,
  OUTBOX_EVENT_TYPES.PRODUCT_WITHDRAWN,
  OUTBOX_EVENT_TYPES.BLOG_PUBLISHED,
  OUTBOX_EVENT_TYPES.CMS_PUBLISHED,
] as const;

export const PHASE6_EVENT_TYPES = [
  OUTBOX_EVENT_TYPES.PUBLICATION_DELIVER_REQUESTED,
] as const;

export const LEASE_EVENT_TYPES = [...PHASE3_EVENT_TYPES, ...PHASE4_EVENT_TYPES, ...PHASE6_EVENT_TYPES] as const;

export function leaseEventTypes(connectorsEnabled = areOmnichannelConnectorsEnabled()): readonly string[] {
  return connectorsEnabled
    ? LEASE_EVENT_TYPES
    : [...PHASE3_EVENT_TYPES, ...PHASE4_EVENT_TYPES];
}

export function buildLeaseSql(types: readonly string[] = leaseEventTypes()): string {
  return `
WITH cte AS (
  SELECT id
  FROM omnichannel_outbox_events
  WHERE "eventType" IN ('${types.join("','")}')
    AND "availableAt" <= NOW()
    AND (
      status = 'PENDING'
      OR (status = 'PROCESSING' AND "lockedAt" IS NOT NULL AND "lockedAt" < NOW() - INTERVAL '5 minutes')
    )
  ORDER BY "availableAt" ASC
  LIMIT $1
  FOR UPDATE SKIP LOCKED
)
UPDATE omnichannel_outbox_events e
SET
  status = 'PROCESSING',
  "lockedAt" = NOW(),
  "lockedBy" = $2,
  attempts = e.attempts + 1
FROM cte
WHERE e.id = cte.id
RETURNING e.*
`;
}

export function nextAvailableAt(attempts: number, now = new Date(), jitterRatio = 0): Date {
  const exp = Math.max(1, attempts);
  const base = Math.min(3600, 2 ** Math.min(exp, 12));
  const jitter = Math.min(1, Math.max(0, jitterRatio)) * 0.25 * base;
  return new Date(now.getTime() + (base + jitter) * 1000);
}

export function shouldDeadLetter(attempts: number, maxAttempts: number): boolean {
  return attempts >= Math.max(1, maxAttempts);
}

export const LEASE_SQL = buildLeaseSql(LEASE_EVENT_TYPES);
