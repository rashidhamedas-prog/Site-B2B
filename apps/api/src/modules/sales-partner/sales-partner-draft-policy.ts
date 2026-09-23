import { createHash } from 'crypto';

export const DRAFT_STATUSES = [
  'DRAFT',
  'AWAITING_CUSTOMER_CONFIRMATION',
  'CUSTOMER_CONFIRMED',
  'CONVERTED_TO_ORDER',
  'EXPIRED',
  'CANCELLED',
  'REJECTED_BY_CUSTOMER',
] as const;
export type SalesPartnerDraftStatus = (typeof DRAFT_STATUSES)[number];

const DRAFT_TRANSITIONS: Record<SalesPartnerDraftStatus, readonly SalesPartnerDraftStatus[]> = {
  DRAFT: ['AWAITING_CUSTOMER_CONFIRMATION', 'CANCELLED', 'EXPIRED'],
  AWAITING_CUSTOMER_CONFIRMATION: [
    'CUSTOMER_CONFIRMED',
    'REJECTED_BY_CUSTOMER',
    'CANCELLED',
    'EXPIRED',
    'DRAFT',
  ],
  CUSTOMER_CONFIRMED: ['CONVERTED_TO_ORDER'],
  CONVERTED_TO_ORDER: [],
  EXPIRED: [],
  CANCELLED: [],
  REJECTED_BY_CUSTOMER: [],
};

export function isDraftStatus(value: string | null | undefined): value is SalesPartnerDraftStatus {
  return !!value && (DRAFT_STATUSES as readonly string[]).includes(value);
}

export function canTransitionDraft(from: string | null | undefined, to: string | null | undefined): boolean {
  if (!isDraftStatus(from) || !isDraftStatus(to)) return false;
  return DRAFT_TRANSITIONS[from].includes(to);
}

export type PartnerCommissionOverlay = 'HELD' | 'AVAILABLE' | 'PAID' | null;

export function partnerCommissionOverlay(
  orderStatus: string | null | undefined,
  rows: Array<{ entryType: string; availableAt: Date | null; payoutId?: string | null }>,
  now: Date,
): PartnerCommissionOverlay {
  if (orderStatus !== 'DELIVERED' && orderStatus !== 'COMPLETED') return null;
  const earned = rows.filter((row) => row.entryType === 'COMMISSION_EARNED');
  if (!earned.length) return 'HELD';
  if (earned.every((row) => row.payoutId)) return 'PAID';
  const unlocked = earned.some(
    (row) => !row.payoutId && row.availableAt && row.availableAt.getTime() <= now.getTime(),
  );
  return unlocked ? 'AVAILABLE' : 'HELD';
}

export function humanPartnerOrderStatus(
  draftStatus: string | null | undefined,
  orderStatus?: string | null,
  commissionOverlay?: PartnerCommissionOverlay,
): string {
  if (draftStatus && draftStatus !== 'CONVERTED_TO_ORDER') {
    return humanDraftStatus(draftStatus);
  }
  switch (orderStatus) {
    case 'AWAITING_PAYMENT':
      return 'منتظر پرداخت';
    case 'PENDING_REVIEW':
      return 'در بررسی';
    case 'CONFIRMED':
    case 'PROCESSING':
    case 'PACKED':
      return 'در حال آماده‌سازی';
    case 'SHIPPED':
      return 'ارسال‌شده';
    case 'DELIVERED':
    case 'COMPLETED':
      if (commissionOverlay === 'AVAILABLE') return 'پورسانت قابل‌برداشت';
      if (commissionOverlay === 'HELD') return 'در انتظار آزادشدن پورسانت';
      return 'تحویل‌شده';
    case 'CANCELLED':
    case 'DELETED':
      return 'لغوشده';
    case 'RETURNED':
    case 'REFUNDED':
      return 'مرجوع‌شده';
    default:
      return humanDraftStatus(draftStatus);
  }
}

export function humanDraftStatus(status: string | null | undefined): string {
  switch (status) {
    case 'DRAFT':
      return 'پیش‌نویس';
    case 'AWAITING_CUSTOMER_CONFIRMATION':
      return 'منتظر تأیید مشتری';
    case 'CUSTOMER_CONFIRMED':
      return 'تأییدشده';
    case 'CONVERTED_TO_ORDER':
      return 'تبدیل به سفارش';
    case 'EXPIRED':
      return 'منقضی‌شده';
    case 'CANCELLED':
      return 'لغوشده';
    case 'REJECTED_BY_CUSTOMER':
      return 'ردشده توسط مشتری';
    default:
      return 'نامشخص';
  }
}

export function confirmationSmsText(displayName: string, confirmUrl: string): string {
  const name = displayName.trim() || 'ترنم';
  return `همکار فروش ${name} یک سبد برای شما آماده کرده است. تا زمانی که خودتان آن را تأیید نکنید سفارشی ثبت یا مبلغی دریافت نمی‌شود. ${confirmUrl}`;
}

export function isDraftExpired(expiresAt: Date | null | undefined, now: Date): boolean {
  return !!expiresAt && expiresAt.getTime() <= now.getTime();
}

export function hashConfirmationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function priceDriftBps(fromIrr: number, toIrr: number): number {
  if (!Number.isInteger(fromIrr) || !Number.isInteger(toIrr) || fromIrr < 0 || toIrr < 0) {
    throw new Error('INVALID_PRICE');
  }
  if (fromIrr === toIrr) return 0;
  if (fromIrr === 0) return 10_000;
  return Math.floor((Math.abs(toIrr - fromIrr) * 10_000) / fromIrr);
}

export function maskCustomerPhone(phone: string | null | undefined): string | null {
  if (!phone || phone.length < 8) return null;
  return `${phone.slice(0, 4)}***${phone.slice(-2)}`;
}
