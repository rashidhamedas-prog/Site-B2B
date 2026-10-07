import type { CommissionBucket, DraftRow, PartnerCommissionSlice, PartnerRow } from './types';

const CLOSED_DRAFTS = new Set(['EXPIRED', 'CANCELLED', 'REJECTED_BY_CUSTOMER']);

export type SpDeskNav = {
  tab: import('./types').Tab;
  appFilter?: string;
  partnerFilter?: string;
  orderFilter?: string;
};

/** Ops-desk hint: what the admin should know, not the partner CTA. */
export function adminDraftNextStep(status: string, stale?: boolean): string {
  if (stale) return 'قیمت یا موجودی نسبت به زمان ثبت عوض شده؛ همکار باید قبل از ارسال لینک دوباره بررسی کند.';
  switch (status) {
    case 'DRAFT':
      return 'این پیش‌نویس هنوز برای مشتری ارسال نشده. جزئیات را ببینید؛ ادامه ثبت از پنل همکار است.';
    case 'AWAITING_CUSTOMER_CONFIRMATION':
      return 'لینک تأیید برای مشتری رفته است. منتظر تصمیم مشتری بمانید.';
    case 'CUSTOMER_CONFIRMED':
      return 'مشتری تأیید کرده اما سفارش فروشگاه هنوز کامل نشده.';
    case 'CONVERTED_TO_ORDER':
      return 'سفارش فروشگاه ثبت شده. پرداخت و ارسال در میز سفارش‌های فروشگاه پیگیری می‌شود.';
    case 'REJECTED_BY_CUSTOMER':
      return 'مشتری این پیش‌سفارش را نپذیرفت.';
    case 'EXPIRED':
      return 'مهلت لینک تمام شده است.';
    case 'CANCELLED':
      return 'این پیش‌سفارش لغو شده است.';
    default:
      return 'جزئیات پیش‌سفارش را باز کنید.';
  }
}

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

/** Non-zero partner shares for one money card, largest amount first. */
export function partnerSlicesForBucket(
  rows: PartnerCommissionSlice[] | undefined,
  bucket: CommissionBucket,
): Array<{ salesPartnerId: string; amountIrr: number }> {
  return (rows || [])
    .map((row) => ({ salesPartnerId: row.salesPartnerId, amountIrr: row[bucket] }))
    .filter((row) => row.amountIrr !== 0)
    .sort((a, b) => b.amountIrr - a.amountIrr || a.salesPartnerId.localeCompare(b.salesPartnerId));
}

export const COMMISSION_SCOPE_FA: Record<string, string> = {
  PROGRAM: 'نرخ برنامه',
  CATEGORY: 'نرخ دسته',
  PRODUCT: 'نرخ محصول',
  PARTNER_CATEGORY: 'نرخ همکار برای دسته',
  PARTNER_PRODUCT: 'نرخ همکار برای محصول',
};

export function productCommissionFollowsProgram(note: string | null | undefined): boolean {
  return !String(note || '').startsWith('override:');
}

export function activeProgramRule<T extends { scope: string; active: boolean; createdAt?: string | null }>(
  rules: T[],
): T | null {
  const rows = rules.filter((row) => row.scope === 'PROGRAM' && row.active);
  rows.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  return rows[0] ?? null;
}

export function commissionDeskCounts(
  rules: Array<{ scope: string; active: boolean; note: string | null }>,
): { followers: number; overrides: number } {
  let followers = 0;
  let overrides = 0;
  for (const row of rules) {
    if (!row.active || row.scope !== 'PRODUCT') continue;
    if (productCommissionFollowsProgram(row.note)) followers += 1;
    else overrides += 1;
  }
  return { followers, overrides };
}

/** Integer IRR. 1_000_000 ریال = 100_000 تومان. */
export function samplePartnerCommissionIrr(saleIrr: number, percent: number): number {
  if (!Number.isInteger(saleIrr) || saleIrr < 0 || !Number.isInteger(percent) || percent < 0 || percent > 80) {
    return 0;
  }
  return Math.floor((saleIrr * percent) / 100);
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
