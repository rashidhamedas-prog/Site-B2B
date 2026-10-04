import type { DraftRow, PartnerRow } from './types';

const CLOSED_DRAFTS = new Set(['EXPIRED', 'CANCELLED', 'REJECTED_BY_CUSTOMER']);

export type SpDeskNav = {
  tab: import('./types').Tab;
  appFilter?: string;
  partnerFilter?: string;
  orderFilter?: string;
};

export function isActionableDraft(row: Pick<DraftRow, 'status' | 'convertedOrderId' | 'orderStatus'>): boolean {
  const status = row.status || '';
  if (CLOSED_DRAFTS.has(status)) return false;
  if (status === 'CUSTOMER_CONFIRMED') return true;
  if (status === 'DRAFT' || status === 'AWAITING_CUSTOMER_CONFIRMATION') return true;
  if (status === 'CONVERTED_TO_ORDER' && row.orderStatus === 'AWAITING_PAYMENT') return true;
  return false;
}

export function draftActionPriority(row: Pick<DraftRow, 'status' | 'orderStatus'>): number {
  if (row.status === 'CUSTOMER_CONFIRMED') return 0;
  if (row.status === 'CONVERTED_TO_ORDER' && row.orderStatus === 'AWAITING_PAYMENT') return 1;
  if (row.status === 'AWAITING_CUSTOMER_CONFIRMATION') return 2;
  if (row.status === 'DRAFT') return 3;
  return 9;
}

export function actionableDrafts(rows: DraftRow[], limit = 8): DraftRow[] {
  return rows
    .filter(isActionableDraft)
    .sort((a, b) => draftActionPriority(a) - draftActionPriority(b))
    .slice(0, limit);
}

export function partnerNameById(partners: PartnerRow[], id: string | null | undefined): string {
  if (!id) return '';
  return partners.find((row) => row.id === id)?.displayName || '';
}

export function auditTab(targetType: string): import('./types').Tab {
  switch (targetType) {
    case 'application':
      return 'applications';
    case 'profile':
      return 'partners';
    case 'order':
      return 'orders';
    case 'payout':
      return 'payouts';
    case 'settings':
      return 'settings';
    case 'catalog':
      return 'catalog';
    case 'rule':
      return 'rules';
    default:
      return 'reports';
  }
}

export function matchesPartnerSearch(row: PartnerRow, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return [row.displayName, row.phoneMasked, row.ibanMasked, row.id]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(needle));
}

export function matchesApplicationSearch(
  row: { displayName: string; phoneMasked: string; city?: string | null; province?: string | null },
  q: string,
): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return [row.displayName, row.phoneMasked, row.city, row.province]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(needle));
}

export function payoutIdempotencyKey(partnerId: string, bankReference: string, availableIrr: number): string {
  return `ui-${partnerId}-${availableIrr}-${bankReference.trim()}`;
}
