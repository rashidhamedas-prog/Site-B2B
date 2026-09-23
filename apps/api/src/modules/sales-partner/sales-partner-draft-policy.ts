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

export type DraftFreshnessAlert = 'PRICE_CHANGED' | 'OUT_OF_STOCK' | 'UNAVAILABLE';

export const DRAFT_FRESHNESS_LABELS: Record<DraftFreshnessAlert, string> = {
  PRICE_CHANGED: 'قیمت فروشگاه عوض شده است. مبلغ نهایی هنگام تأیید از سرور محاسبه می‌شود.',
  OUT_OF_STOCK: 'موجودی فعلی برای این تعداد کافی نیست.',
  UNAVAILABLE: 'این محصول فعلاً در برنامه همکاران قابل فروش نیست.',
};

const OPEN_DRAFT_STATUSES = new Set(['DRAFT', 'AWAITING_CUSTOMER_CONFIRMATION', 'CUSTOMER_CONFIRMED']);

export function draftItemFreshness(input: {
  draftStatus: string | null | undefined;
  snapshotUnitPriceIrr: number;
  currentUnitPriceIrr: number | null;
  currentStock: number | null;
  quantity: number;
  productActive: boolean;
}): DraftFreshnessAlert[] {
  if (!input.draftStatus || !OPEN_DRAFT_STATUSES.has(input.draftStatus)) return [];
  const alerts: DraftFreshnessAlert[] = [];
  if (!input.productActive || input.currentUnitPriceIrr == null) {
    alerts.push('UNAVAILABLE');
    return alerts;
  }
  if (input.currentUnitPriceIrr !== input.snapshotUnitPriceIrr) alerts.push('PRICE_CHANGED');
  if ((input.currentStock ?? 0) < input.quantity) alerts.push('OUT_OF_STOCK');
  return alerts;
}

export function humanDraftFreshness(alerts: DraftFreshnessAlert[]): string[] {
  return [...new Set(alerts)].map((code) => DRAFT_FRESHNESS_LABELS[code]);
}

export function priceDriftBps(fromIrr: number, toIrr: number): number {
  if (!Number.isInteger(fromIrr) || !Number.isInteger(toIrr) || fromIrr < 0 || toIrr < 0) {
    throw new Error('INVALID_PRICE');
  }
  if (fromIrr === toIrr) return 0;
  if (fromIrr === 0) return 10_000;
  return Math.floor((Math.abs(toIrr - fromIrr) * 10_000) / fromIrr);
}

export function resolveConfirmPaymentMethod(
  requested: string | null | undefined,
  cashEnabled: boolean,
): 'ONLINE' | 'CASH' {
  return requested === 'CASH' && cashEnabled ? 'CASH' : 'ONLINE';
}

export function resendBlockedReason(
  lastSentAt: Date | null | undefined,
  sentCount: number,
  now: Date,
  cooldownSeconds: number,
  dailyCap: number,
): 'COOLDOWN' | 'DAILY_CAP' | null {
  if (sentCount >= dailyCap) return 'DAILY_CAP';
  if (lastSentAt) {
    const wait = cooldownSeconds * 1000 - (now.getTime() - lastSentAt.getTime());
    if (wait > 0) return 'COOLDOWN';
  }
  return null;
}

export function isBlockedSelfReferral(
  customerPhone: string,
  partnerPhone: string,
  blockSelf: boolean,
): boolean {
  return blockSelf && customerPhone === partnerPhone;
}

export function smsFailureBlocksSend(nodeEnv: string | undefined, sent: boolean): boolean {
  return nodeEnv === 'production' && !sent;
}

export function confirmPageGone(status: string | null | undefined): boolean {
  return status !== 'AWAITING_CUSTOMER_CONFIRMATION';
}

export function confirmActionGone(status: string | null | undefined): boolean {
  return status !== 'AWAITING_CUSTOMER_CONFIRMATION'
    && status !== 'CUSTOMER_CONFIRMED'
    && status !== 'CONVERTED_TO_ORDER';
}

export function maskCustomerPhone(phone: string | null | undefined): string | null {
  if (!phone || phone.length < 8) return null;
  return `${phone.slice(0, 4)}***${phone.slice(-2)}`;
}
