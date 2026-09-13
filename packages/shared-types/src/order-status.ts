/**
 * Single source of truth for order lifecycle.
 * Admin queues, customer steppers, and API transitions must import from here.
 *
 * Shape follows Vendure/Medusa/WooCommerce: explicit FSM, no inferred jumps.
 * Payment capture still owns AWAITING_PAYMENT → PENDING_REVIEW.
 */

export const ORDER_STATUS_LABEL_FA: Record<string, string> = {
  DRAFT: 'پیش‌نویس',
  AWAITING_PAYMENT: 'در انتظار پرداخت',
  PENDING_REVIEW: 'در انتظار بررسی',
  CONFIRMED: 'تأیید شده',
  PROCESSING: 'در حال پردازش',
  PACKED: 'بسته‌بندی شده',
  PACKING: 'در حال پردازش',
  SHIPPED: 'ارسال شده',
  DELIVERED: 'تحویل داده شده',
  COMPLETED: 'تکمیل شده',
  CANCELLED: 'لغو شده',
  DELETED: 'حذف‌شده',
  RETURN_REQUESTED: 'درخواست مرجوع',
  RETURN_APPROVED: 'مرجوع تأیید شده',
  RETURNED: 'مرجوع شده',
  REFUNDED: 'بازپرداخت شده',
};

export type OrderStatusVariant =
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'neutral'
  | 'primary';

export const ORDER_STATUS_VARIANT: Record<string, OrderStatusVariant> = {
  DRAFT: 'neutral',
  AWAITING_PAYMENT: 'warning',
  PENDING_REVIEW: 'warning',
  CONFIRMED: 'primary',
  PROCESSING: 'info',
  PACKED: 'info',
  PACKING: 'info',
  SHIPPED: 'primary',
  DELIVERED: 'success',
  COMPLETED: 'success',
  CANCELLED: 'error',
  DELETED: 'error',
  RETURN_REQUESTED: 'warning',
  RETURN_APPROVED: 'warning',
  RETURNED: 'neutral',
  REFUNDED: 'success',
};

/** Admin operational queues in fulfillment order. */
export const ADMIN_ORDER_QUEUES = [
  'AWAITING_PAYMENT',
  'PENDING_REVIEW',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
  'DELETED',
] as const;

export type AdminOrderQueue = (typeof ADMIN_ORDER_QUEUES)[number];

/** Happy-path stepper for customer / portal / admin detail. */
export const CUSTOMER_STATUS_FLOW = [
  'PENDING_REVIEW',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'COMPLETED',
] as const;

export const ORDER_TRANSITIONS: Record<string, readonly string[]> = {
  AWAITING_PAYMENT: ['CANCELLED', 'DELETED'],
  PENDING_REVIEW: ['CONFIRMED', 'PROCESSING', 'CANCELLED', 'DELETED'],
  CONFIRMED: ['PROCESSING', 'SHIPPED', 'CANCELLED', 'DELETED'],
  PROCESSING: ['SHIPPED', 'CANCELLED', 'DELETED'],
  SHIPPED: ['DELIVERED', 'CANCELLED'],
  DELIVERED: ['COMPLETED', 'REFUNDED'],
  COMPLETED: ['REFUNDED'],
  CANCELLED: ['DELETED'],
  DELETED: [],
  REFUNDED: [],
};

const KNOWN_STATUSES = new Set([
  ...Object.keys(ORDER_STATUS_LABEL_FA),
  ...Object.keys(ORDER_TRANSITIONS),
]);

export function normalizeOrderStatus(status?: string | null): string {
  return String(status || '').trim().toUpperCase();
}

export function isKnownOrderStatus(status?: string | null): boolean {
  const key = normalizeOrderStatus(status);
  return key.length > 0 && KNOWN_STATUSES.has(key);
}

export function isAdminOrderQueue(status?: string | null): boolean {
  return (ADMIN_ORDER_QUEUES as readonly string[]).includes(normalizeOrderStatus(status));
}

export function orderStatusLabelFa(status?: string | null): string {
  const key = normalizeOrderStatus(status);
  return ORDER_STATUS_LABEL_FA[key] || key || 'نامشخص';
}

export function canTransitionOrderStatus(from: string, to: string): boolean {
  const prev = normalizeOrderStatus(from);
  const next = normalizeOrderStatus(to);
  if (!prev || !next) return false;
  if (prev === next) return true;
  const allowed = ORDER_TRANSITIONS[prev];
  return Array.isArray(allowed) && allowed.includes(next);
}

export function nextOrderStatuses(from: string): string[] {
  return [...(ORDER_TRANSITIONS[normalizeOrderStatus(from)] ?? [])];
}

export type AdminQueueAction = {
  to: string;
  label: string;
  kind: 'primary' | 'danger';
  confirm?: string;
};

/** Compact list actions. Detail page may add tracking (SHIPPED) separately. */
export function adminQueueActions(status: string): AdminQueueAction[] {
  switch (normalizeOrderStatus(status)) {
    case 'AWAITING_PAYMENT':
      return [
        {
          to: 'CANCELLED',
          label: 'لغو پرداخت‌نشده',
          kind: 'danger',
          confirm: 'سفارش پرداخت‌نشده لغو شود؟',
        },
      ];
    case 'PENDING_REVIEW':
      return [
        { to: 'CONFIRMED', label: 'تأیید سفارش', kind: 'primary' },
        {
          to: 'CANCELLED',
          label: 'رد سفارش',
          kind: 'danger',
          confirm: 'سفارش رد و لغو شود؟',
        },
      ];
    case 'CONFIRMED':
      return [{ to: 'PROCESSING', label: 'شروع پردازش', kind: 'primary' }];
    case 'SHIPPED':
      return [{ to: 'DELIVERED', label: 'علامت تحویل', kind: 'primary' }];
    case 'DELIVERED':
      return [{ to: 'COMPLETED', label: 'تکمیل سفارش', kind: 'primary' }];
    default:
      return [];
  }
}

export function adminDetailActions(status: string): AdminQueueAction[] {
  const key = normalizeOrderStatus(status);
  if (key === 'PENDING_REVIEW') {
    return [
      { to: 'CONFIRMED', label: 'تأیید سفارش', kind: 'primary' },
      { to: 'PROCESSING', label: 'تأیید و شروع پردازش', kind: 'primary' },
      {
        to: 'CANCELLED',
        label: 'رد سفارش',
        kind: 'danger',
        confirm: 'سفارش رد و لغو شود؟',
      },
    ];
  }
  return adminQueueActions(key);
}

export function adminQueueHint(status: string): string {
  switch (normalizeOrderStatus(status)) {
    case '':
      return 'همه سفارش‌ها، از جمله حذف‌شده. برای کار روزانه از صف‌های وضعیت استفاده کنید.';
    case 'AWAITING_PAYMENT':
      return 'پرداخت آنلاین هنوز نهایی نشده. بعد از واریز موفق، سفارش خودش به صف بررسی می‌رود.';
    case 'PENDING_REVIEW':
      return 'پرداخت شده و منتظر تأیید انبار/فروش است. تأیید موجودی را قفل می‌کند.';
    case 'CONFIRMED':
      return 'تأیید شده — برچسب بسته‌بندی چاپ کنید، سپس پردازش را شروع کنید یا با کد رهگیری ارسال کنید.';
    case 'PROCESSING':
      return 'در حال آماده‌سازی. با ثبت کد رهگیری وضعیت به «ارسال شده» می‌رود و برای مشتری پیامک می‌شود.';
    case 'SHIPPED':
      return 'کالا از انبار خارج شده. بعد از رسیدن به مشتری، تحویل را ثبت کنید.';
    case 'DELIVERED':
      return 'تحویل ثبت شده. با تکمیل، سفارش از صف عملیاتی خارج می‌شود.';
    case 'COMPLETED':
      return 'سفارش بسته شده است. تغییر وضعیت فقط از مسیر مرجوع/بازپرداخت.';
    case 'CANCELLED':
      return 'لغو شده؛ موجودی و کیف‌پول برمی‌گردد. در صورت نیاز می‌توانید ردیف را حذف آرشیوی کنید.';
    case 'DELETED':
      return 'حذف نرم — از ویترین مشتری پنهان است، ولی برای حسابرسی باقی می‌ماند.';
    default:
      return '';
  }
}

export function emptyQueueCopy(status: string): string {
  switch (normalizeOrderStatus(status)) {
    case 'AWAITING_PAYMENT':
      return 'سفارش پرداخت‌نشده‌ای در این کانال نیست.';
    case 'PENDING_REVIEW':
      return 'سفارشی منتظر بررسی نیست.';
    case 'CONFIRMED':
      return 'سفارش تأیید‌شدهٔ باز وجود ندارد.';
    case 'PROCESSING':
      return 'سفارشی در حال پردازش نیست.';
    case 'SHIPPED':
      return 'سفارش ارسال‌شدهٔ باز وجود ندارد.';
    case 'DELIVERED':
      return 'سفارش تحویل‌شدهٔ ناتمامی نیست.';
    case 'COMPLETED':
      return 'سفارش تکمیل‌شده‌ای در این فیلتر نیست.';
    case 'CANCELLED':
      return 'سفارش لغوشده‌ای نیست.';
    case 'DELETED':
      return 'سفارش حذف‌شده‌ای در بایگانی نیست.';
    default:
      return 'سفارشی یافت نشد';
  }
}

/** Map legacy customer aliases onto the live status vocabulary. */
export function canonicalCustomerStatus(status?: string | null): string {
  const key = normalizeOrderStatus(status);
  if (key === 'PACKING' || key === 'PACKED') return 'PROCESSING';
  return key;
}

export function customerStatusStepIndex(status?: string | null): number {
  const key = canonicalCustomerStatus(status);
  if (key === 'AWAITING_PAYMENT' || key === 'CANCELLED' || key === 'DELETED' || key === 'REFUNDED') {
    return -1;
  }
  return (CUSTOMER_STATUS_FLOW as readonly string[]).indexOf(key);
}

export function emptyStatusCounts(): Record<string, number> {
  const counts: Record<string, number> = { ALL: 0 };
  for (const key of ADMIN_ORDER_QUEUES) counts[key] = 0;
  return counts;
}

export function foldStatusCounts(rows: Array<{ status?: string; count?: number | string }>): Record<string, number> {
  const counts = emptyStatusCounts();
  for (const row of rows) {
    const key = normalizeOrderStatus(row.status);
    const n = Number(row.count) || 0;
    counts.ALL += n;
    if (key in counts) counts[key] += n;
  }
  return counts;
}
