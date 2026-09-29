/** Pure helpers for the zero-order (registered, never settled purchase) desk. */

export const AGING_BUCKETS = ['fresh', 'warm', 'aging', 'cool', 'recycle'] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number];

export function agingBucket(daysSinceRegister: number): AgingBucket {
  const d = Math.max(0, Math.floor(Number(daysSinceRegister) || 0));
  if (d <= 2) return 'fresh';
  if (d <= 7) return 'warm';
  if (d <= 30) return 'aging';
  if (d <= 90) return 'cool';
  return 'recycle';
}

export function isAgingBucket(value: unknown): value is AgingBucket {
  return typeof value === 'string' && (AGING_BUCKETS as readonly string[]).includes(value);
}

/** RFM-lite without Monetary: recency + intent + wholesale urgency. 0–100. */
export function zeroOrderPriority(input: {
  daysSinceRegister: number;
  channel: 'RETAIL' | 'WHOLESALE';
  customerStatus: string;
  hasCheckoutIntent: boolean;
  lastCallResult?: string | null;
  daysSinceLastCall?: number | null;
}): number {
  let score = 40;
  const bucket = agingBucket(input.daysSinceRegister);
  if (bucket === 'fresh') score += 30;
  else if (bucket === 'warm') score += 22;
  else if (bucket === 'aging') score += 12;
  else if (bucket === 'cool') score -= 10;
  else score -= 25;

  if (input.hasCheckoutIntent) score += 20;

  const status = String(input.customerStatus || '').toUpperCase();
  if (input.channel === 'WHOLESALE' && status === 'PENDING') score += 15;

  const call = String(input.lastCallResult || '').toUpperCase();
  if (call === 'CALLBACK') score += 10;
  else if (input.daysSinceLastCall == null) score += 8;
  else if (input.daysSinceLastCall >= 7) score += 5;

  return Math.max(0, Math.min(100, score));
}

export function isZeroOrderEligible(input: {
  channel: 'RETAIL' | 'WHOLESALE';
  customerStatus: string;
  settledOrderCount: number;
  deleted?: boolean;
}): boolean {
  if (input.deleted) return false;
  if ((input.settledOrderCount || 0) > 0) return false;
  if (input.channel === 'RETAIL') return true;
  const st = String(input.customerStatus || '').toUpperCase();
  return st === 'PENDING' || st === 'ACTIVE' || st === 'APPROVED';
}

export const SETTLED_SQL_IN = `'CONFIRMED','PROCESSING','SHIPPED','DELIVERED','COMPLETED'`;
