/** Pure vendor rules — no Nest. Keep HTTP mapping in the service. */

export const VENDOR_ROLE = 'VENDOR';

export const VENDOR_STATUSES = ['INVITED', 'ACTIVE', 'SUSPENDED'] as const;
export type VendorStatus = (typeof VENDOR_STATUSES)[number];

export const ACCEPT_SLA_HOURS_MIN = 1;
export const ACCEPT_SLA_HOURS_MAX = 168;
export const SETTLEMENT_HOLD_DAYS_MIN = 0;
export const SETTLEMENT_HOLD_DAYS_MAX = 90;

export function isVendorRole(role: string | null | undefined): boolean {
  return role === VENDOR_ROLE;
}

export function isVendorStatus(value: string | null | undefined): value is VendorStatus {
  return !!value && (VENDOR_STATUSES as readonly string[]).includes(value);
}

export function canVendorLogin(status: string | null | undefined): boolean {
  return status === 'INVITED' || status === 'ACTIVE';
}

export function parseAcceptSlaHours(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < ACCEPT_SLA_HOURS_MIN || n > ACCEPT_SLA_HOURS_MAX) {
    throw new Error('INVALID_SLA');
  }
  return n;
}

export function parseSettlementHoldDays(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < SETTLEMENT_HOLD_DAYS_MIN || n > SETTLEMENT_HOLD_DAYS_MAX) {
    throw new Error('INVALID_HOLD');
  }
  return n;
}

export function parseVendorName(raw: unknown): string {
  const name = String(raw ?? '').trim();
  if (name.length < 2 || name.length > 120) throw new Error('INVALID_NAME');
  return name;
}

/** Horizontal isolation: vendor JWT may only touch its own aggregate. */
export function vendorOwnsResource(
  actorVendorId: string | null | undefined,
  resourceVendorId: string | null | undefined,
): boolean {
  return !!actorVendorId && !!resourceVendorId && actorVendorId === resourceVendorId;
}

export type PublicVendor = {
  id: string;
  name: string;
  phone: string;
  status: VendorStatus;
  acceptSlaHours: number;
  settlementHoldDays: number;
  userId: string;
  notes: string | null;
  invitedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export function toPublicVendor(row: {
  id: string;
  name: string;
  phone: string;
  status: string;
  acceptSlaHours: number;
  settlementHoldDays: number;
  userId: string;
  notes: string | null;
  invitedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): PublicVendor {
  const status: VendorStatus = isVendorStatus(row.status) ? row.status : 'INVITED';
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    status,
    acceptSlaHours: row.acceptSlaHours,
    settlementHoldDays: row.settlementHoldDays,
    userId: row.userId,
    notes: row.notes,
    invitedAt: row.invitedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
