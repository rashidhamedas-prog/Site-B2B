/** Audience sources. Priority is fixed by the owner: wholesale, then referral, then sales partner, then retail. */
export const AUDIENCE_SOURCE_PRIORITY = [
  'WHOLESALE',
  'WHOLESALE_REFERRAL',
  'SALES_PARTNER',
  'RETAIL',
] as const;

export type AudienceSource = (typeof AUDIENCE_SOURCE_PRIORITY)[number];

export const AUDIENCE_PHONE_KINDS = ['PRIMARY', 'SECONDARY'] as const;
export type AudiencePhoneKind = (typeof AUDIENCE_PHONE_KINDS)[number];

export const PARTNER_CONSENT_SOURCE_DEFAULT = 'OWNER_DEFAULT_POLICY';
export const PARTNER_CONSENT_SOURCE_BACKFILL = 'OWNER_DEFAULT_POLICY_BACKFILL';

export type AudienceContact = {
  phone: string;
  sources: AudienceSource[];
  phoneKinds: AudiencePhoneKind[];
  customerId?: string;
  salesPartnerId?: string;
  referralPartnerId?: string;
  name: string;
  city?: string;
  province?: string;
  customerSegment?: string;
  partnerStatus?: string;
  referralStatus?: string;
  lastOrderAt?: string | null;
  orderCount: number;
  orderStatuses: string[];
  promoConsent: boolean;
  consentSource: string | null;
  optedOut: boolean;
  blacklisted: boolean;
};

/** One phone slot from one source, before dedupe. */
export type AudienceHit = {
  phoneRaw: string;
  source: AudienceSource;
  phoneKind: AudiencePhoneKind;
  customerId?: string;
  salesPartnerId?: string;
  referralPartnerId?: string;
  name: string;
  city?: string;
  province?: string;
  customerSegment?: string;
  partnerStatus?: string;
  referralStatus?: string;
  lastOrderAt?: string | null;
  orderCount?: number;
  orderStatuses?: string[];
  promoConsent: boolean;
  consentSource?: string | null;
};

export function isAudienceSource(value: string): value is AudienceSource {
  return (AUDIENCE_SOURCE_PRIORITY as readonly string[]).includes(value);
}

export function sourcePriority(source: AudienceSource): number {
  return AUDIENCE_SOURCE_PRIORITY.indexOf(source);
}

export function masksAudiencePhone(role?: string | null): boolean {
  return role === 'SMS_OPERATOR' || role === 'SMS_MARKETER';
}
