/**
 * Single source of truth for CRM customer status, segment, and channel labels.
 * Admin list, dossier, marketing, and storefront panels must import from here.
 */

export const CUSTOMER_STATUSES = ['PENDING', 'ACTIVE', 'INACTIVE'] as const;
export type CustomerAccountStatus = (typeof CUSTOMER_STATUSES)[number];

export const CUSTOMER_SEGMENTS = ['VIP', 'A', 'B', 'C'] as const;
export type CustomerSegmentCode = (typeof CUSTOMER_SEGMENTS)[number];

export const CUSTOMER_CHANNELS = ['ALL', 'RETAIL', 'WHOLESALE'] as const;
export type CustomerListChannel = (typeof CUSTOMER_CHANNELS)[number];

export const CUSTOMER_STATUS_LABEL_FA: Record<CustomerAccountStatus, string> = {
  PENDING: 'در انتظار تأیید',
  ACTIVE: 'فعال',
  INACTIVE: 'غیرفعال',
};

export const CUSTOMER_SEGMENT_LABEL_FA: Record<CustomerSegmentCode, string> = {
  VIP: 'VIP',
  A: 'A',
  B: 'B',
  C: 'C',
};

export const CUSTOMER_CHANNEL_LABEL_FA: Record<CustomerListChannel, string> = {
  ALL: 'کامل',
  RETAIL: 'تکی',
  WHOLESALE: 'عمده',
};

export function isCustomerAccountStatus(value: unknown): value is CustomerAccountStatus {
  return typeof value === 'string' && (CUSTOMER_STATUSES as readonly string[]).includes(value);
}

export function isCustomerSegment(value: unknown): value is CustomerSegmentCode {
  return typeof value === 'string' && (CUSTOMER_SEGMENTS as readonly string[]).includes(value);
}

export function isCustomerListChannel(value: unknown): value is CustomerListChannel {
  return typeof value === 'string' && (CUSTOMER_CHANNELS as readonly string[]).includes(value);
}

export function isRetailCustomerType(type?: string | null): boolean {
  const t = String(type || '').toUpperCase();
  return t === 'RETAIL' || t === 'B2C';
}

export function customerChannelOf(type?: string | null): 'RETAIL' | 'WHOLESALE' {
  return isRetailCustomerType(type) ? 'RETAIL' : 'WHOLESALE';
}

export function customerStatusLabelFa(status?: string | null): string {
  const key = String(status || '').toUpperCase();
  return isCustomerAccountStatus(key) ? CUSTOMER_STATUS_LABEL_FA[key] : key || '—';
}

export function customerChannelLabelFa(channel?: string | null): string {
  const key = String(channel || '').toUpperCase();
  if (key === 'RETAIL' || key === 'B2C') return CUSTOMER_CHANNEL_LABEL_FA.RETAIL;
  if (key === 'WHOLESALE' || key === 'B2B') return CUSTOMER_CHANNEL_LABEL_FA.WHOLESALE;
  return isCustomerListChannel(key) ? CUSTOMER_CHANNEL_LABEL_FA[key] : 'عمده';
}
