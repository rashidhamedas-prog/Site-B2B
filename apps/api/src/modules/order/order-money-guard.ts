/**
 * Paid gateway money must outlive admin delete clicks.
 * Void/purge of a captured ONLINE order used to reverse stock and hard-delete
 * the row while DigiPay/TorobPay kept the rials — the order vanished from ops.
 */

const CAPTURED_PAYMENT_STATUSES = ['PAID', 'REFUNDED'] as const;

export function isCapturedPaymentStatus(status: string | null | undefined): boolean {
  const s = String(status || '').toUpperCase();
  return (CAPTURED_PAYMENT_STATUSES as readonly string[]).includes(s);
}

export function capturedPaymentBlocksDestructiveAdmin(input: {
  paymentStatuses: Array<string | null | undefined>;
}): { allowed: true } | { allowed: false; reason: string } {
  if (input.paymentStatuses.some((status) => isCapturedPaymentStatus(status))) {
    return {
      allowed: false,
      reason:
        'این سفارش پرداخت آنلاین ثبت‌شده دارد. حذف نرم/کامل مجاز نیست؛ در صورت نیاز استرداد از درگاه انجام شود.',
    };
  }
  return { allowed: true };
}
