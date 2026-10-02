export const SUPPORT_STATUSES = [
  'OPEN',
  'IN_PROGRESS',
  'WAITING_CUSTOMER',
  'RESOLVED',
  'CLOSED',
] as const;

export type SupportTicketStatus = (typeof SUPPORT_STATUSES)[number];

export const SUPPORT_CATEGORIES = [
  'ORDER',
  'PRODUCT',
  'PAYMENT',
  'SHIPPING',
  'ACCOUNT',
  'OTHER',
] as const;

export type SupportTicketCategory = (typeof SUPPORT_CATEGORIES)[number];

export const SUPPORT_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;

export type SupportTicketPriority = (typeof SUPPORT_PRIORITIES)[number];

const ALLOWED: Record<SupportTicketStatus, SupportTicketStatus[]> = {
  OPEN: ['IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED'],
  IN_PROGRESS: ['OPEN', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED'],
  WAITING_CUSTOMER: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  RESOLVED: ['OPEN', 'IN_PROGRESS', 'CLOSED'],
  CLOSED: ['OPEN'],
};

export function isSupportStatus(raw: string): raw is SupportTicketStatus {
  return (SUPPORT_STATUSES as readonly string[]).includes(raw);
}

export function isSupportCategory(raw: string): raw is SupportTicketCategory {
  return (SUPPORT_CATEGORIES as readonly string[]).includes(raw);
}

export function isSupportPriority(raw: string): raw is SupportTicketPriority {
  return (SUPPORT_PRIORITIES as readonly string[]).includes(raw);
}

export function canTransitionSupportStatus(
  from: string,
  to: string,
): boolean {
  if (from === to) return true;
  if (!isSupportStatus(from) || !isSupportStatus(to)) return false;
  return ALLOWED[from].includes(to);
}

/** After customer reply: reopen waiting/resolved tickets. */
export function statusAfterCustomerReply(current: string): SupportTicketStatus {
  if (current === 'WAITING_CUSTOMER' || current === 'RESOLVED') return 'OPEN';
  if (isSupportStatus(current) && current !== 'CLOSED') return current;
  return 'OPEN';
}

/** After staff public reply: wait for customer unless already terminal. */
export function statusAfterStaffReply(current: string): SupportTicketStatus {
  if (current === 'CLOSED' || current === 'RESOLVED') return current as SupportTicketStatus;
  return 'WAITING_CUSTOMER';
}

export function normalizeCategory(raw?: string | null): SupportTicketCategory {
  const c = String(raw || '').toUpperCase();
  return isSupportCategory(c) ? c : 'OTHER';
}

export function normalizePriority(raw?: string | null): SupportTicketPriority {
  const p = String(raw || '').toUpperCase();
  return isSupportPriority(p) ? p : 'NORMAL';
}
