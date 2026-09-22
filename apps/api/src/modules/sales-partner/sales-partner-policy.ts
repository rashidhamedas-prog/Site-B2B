/** Pure SalesPartner rules — no Nest. Do not import Vendor or affiliate types. */

export const SALES_PARTNER_ACTING_ROLE = 'SALES_PARTNER';
export const SALES_PARTNER_PURPOSE = 'sales_partner';

export const SALES_PARTNER_PROFILE_STATUSES = [
  'PENDING_REVIEW',
  'NEEDS_INFORMATION',
  'ACTIVE',
  'SUSPENDED',
  'REJECTED',
  'CLOSED',
] as const;
export type SalesPartnerProfileStatus = (typeof SALES_PARTNER_PROFILE_STATUSES)[number];

export const OPEN_APPLICATION_STATUSES = ['PENDING_OTP', 'PENDING_REVIEW', 'NEEDS_INFORMATION'] as const;
export type SalesPartnerApplicationStatus =
  | (typeof OPEN_APPLICATION_STATUSES)[number]
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

const PROFILE_TRANSITIONS: Record<SalesPartnerProfileStatus, readonly SalesPartnerProfileStatus[]> = {
  PENDING_REVIEW: ['ACTIVE', 'NEEDS_INFORMATION', 'REJECTED'],
  NEEDS_INFORMATION: ['PENDING_REVIEW', 'REJECTED'],
  ACTIVE: ['SUSPENDED', 'CLOSED'],
  SUSPENDED: ['ACTIVE', 'CLOSED'],
  REJECTED: [],
  CLOSED: [],
};

export function isSalesPartnerActingRole(role: string | null | undefined): boolean {
  return role === SALES_PARTNER_ACTING_ROLE;
}

export function isSalesPartnerPurpose(purpose?: string | null): boolean {
  return purpose === SALES_PARTNER_PURPOSE;
}

export function isSalesPartnerProfileStatus(
  value: string | null | undefined,
): value is SalesPartnerProfileStatus {
  return !!value && (SALES_PARTNER_PROFILE_STATUSES as readonly string[]).includes(value);
}

export function canTransitionProfile(
  from: string | null | undefined,
  to: string | null | undefined,
): boolean {
  if (!isSalesPartnerProfileStatus(from) || !isSalesPartnerProfileStatus(to)) return false;
  return PROFILE_TRANSITIONS[from].includes(to);
}

export function canSalesPartnerLogin(status: string | null | undefined): boolean {
  return status === 'ACTIVE';
}

export function canSalesPartnerCreateDraft(status: string | null | undefined): boolean {
  return status === 'ACTIVE';
}

export function isOpenApplicationStatus(status: string | null | undefined): boolean {
  return !!status && (OPEN_APPLICATION_STATUSES as readonly string[]).includes(status);
}

export function salesPartnerOwnsResource(
  actorId: string | null | undefined,
  resourceId: string | null | undefined,
): boolean {
  return !!actorId && !!resourceId && actorId === resourceId;
}

export function parseDisplayName(raw: unknown): string {
  const name = String(raw ?? '').trim();
  if (name.length < 2 || name.length > 80) throw new Error('INVALID_DISPLAY_NAME');
  return name;
}

export function parseReviewReason(raw: unknown): string {
  const reason = String(raw ?? '').trim();
  if (reason.length < 3 || reason.length > 500) throw new Error('INVALID_REASON');
  return reason;
}

const IRAN_IBAN = /^IR[0-9]{24}$/;

export function normalizeIban(raw: unknown): string {
  const iban = String(raw ?? '').replace(/[\s-]/g, '').toUpperCase();
  if (!IRAN_IBAN.test(iban)) throw new Error('INVALID_IBAN');
  return iban;
}

export function maskIban(iban: string): string {
  const compact = iban.replace(/[\s-]/g, '').toUpperCase();
  if (compact.length < 8) return 'IR****';
  return `${compact.slice(0, 4)}****${compact.slice(-4)}`;
}

export function ibanLast4(iban: string): string {
  return iban.replace(/[\s-]/g, '').slice(-4);
}

export function maskPhone(phone: string): string {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (digits.length < 4) return '۰۹******';
  return `${digits.slice(0, 4)}***${digits.slice(-2)}`;
}

export function humanProfileStatus(status: string | null | undefined): string {
  switch (status) {
    case 'PENDING_REVIEW':
      return 'در انتظار بررسی';
    case 'NEEDS_INFORMATION':
      return 'نیاز به تکمیل اطلاعات';
    case 'ACTIVE':
      return 'فعال';
    case 'SUSPENDED':
      return 'تعلیق‌شده';
    case 'REJECTED':
      return 'رد شده';
    case 'CLOSED':
      return 'بسته‌شده';
    default:
      return 'نامشخص';
  }
}

export type PublicSalesPartner = {
  id: string;
  displayName: string;
  status: SalesPartnerProfileStatus;
  statusLabel: string;
  statusReason: string | null;
  phoneMasked: string;
  ibanMasked: string | null;
  termsAcceptedAt: string | null;
};

export function toPublicSalesPartner(input: {
  id: string;
  displayName: string;
  status: string;
  statusReason?: string | null;
  phone: string;
  ibanLast4?: string | null;
  termsAcceptedAt?: Date | null;
}): PublicSalesPartner {
  const status = isSalesPartnerProfileStatus(input.status) ? input.status : 'PENDING_REVIEW';
  return {
    id: input.id,
    displayName: input.displayName,
    status,
    statusLabel: humanProfileStatus(status),
    statusReason: input.statusReason ?? null,
    phoneMasked: maskPhone(input.phone),
    ibanMasked: input.ibanLast4 ? `IR****${input.ibanLast4}` : null,
    termsAcceptedAt: input.termsAcceptedAt ? input.termsAcceptedAt.toISOString() : null,
  };
}
