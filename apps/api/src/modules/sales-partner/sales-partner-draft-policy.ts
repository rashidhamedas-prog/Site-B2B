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
