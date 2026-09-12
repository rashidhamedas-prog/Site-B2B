/**
 * Order status vs payment capture. Pure; no Nest/DB.
 *
 * ONLINE with a payable total is not submitted for ops review until
 * a payment is captured. CASH / INSTALLMENT / zero-total stay on the
 * existing review-on-create path (COD / invoice / free).
 */

export const AWAITING_PAYMENT = 'AWAITING_PAYMENT';
export const PENDING_REVIEW = 'PENDING_REVIEW';
export const CONFIRMED = 'CONFIRMED';

const UNPAYABLE_ORDER_STATUSES = [
  'CANCELLED',
  'DELETED',
  'PAID',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'COMPLETED',
  'REFUNDED',
] as const;

export function requiresCapturedPayment(paymentMethod: string, orderTotal: number): boolean {
  return String(paymentMethod || '').toUpperCase() === 'ONLINE' && Number(orderTotal) > 0;
}

export function initialCreateStatus(
  paymentMethod: string,
  orderTotal: number,
): typeof AWAITING_PAYMENT | typeof PENDING_REVIEW {
  return requiresCapturedPayment(paymentMethod, orderTotal) ? AWAITING_PAYMENT : PENDING_REVIEW;
}

export function shouldNotifyOrderRegisteredOnCreate(status: string): boolean {
  return status === PENDING_REVIEW;
}

export function isOrderPayable(status: string): boolean {
  return !(UNPAYABLE_ORDER_STATUSES as readonly string[]).includes(String(status || '').toUpperCase());
}

export function statusAfterCapturedPayment(currentStatus: string): {
  nextStatus: string;
  notifyRegistered: boolean;
} {
  const cur = String(currentStatus || '').toUpperCase();
  if (cur === AWAITING_PAYMENT) {
    return { nextStatus: PENDING_REVIEW, notifyRegistered: true };
  }
  if (cur === PENDING_REVIEW) {
    return { nextStatus: CONFIRMED, notifyRegistered: false };
  }
  return { nextStatus: cur, notifyRegistered: false };
}
