import { BadRequestException } from '@nestjs/common';

/** Allowlisted payment fields exposed to clients — never include meta/internal. */
export type PaymentPublicDto = {
  id: string;
  amount: number;
  currency: string;
  gateway: string;
  status: string;
  authority?: string | null;
  refId?: string | null;
  orderId?: string | null;
  invoiceId?: string | null;
  paidAt?: string | null;
  sandbox?: boolean;
  redirectUrl?: string;
  ok?: boolean;
  alreadyVerified?: boolean;
  cancelled?: boolean;
  error?: string;
};

const PUBLIC_EXTRA_KEYS = new Set<keyof PaymentPublicDto>([
  'sandbox',
  'redirectUrl',
  'ok',
  'alreadyVerified',
  'cancelled',
  'error',
]);

/**
 * Map a payment row (or partial) to the public allowlist.
 * Explicitly strips `meta` and any non-allowlisted fields.
 */
export function toPublicPaymentDto(
  payment: {
    id: string;
    amount: number | string;
    currency?: string;
    gateway?: string;
    status: string;
    authority?: string | null;
    refId?: string | null;
    orderId?: string | null;
    invoiceId?: string | null;
    paidAt?: Date | string | null;
    meta?: unknown;
  },
  extras: Partial<PaymentPublicDto> = {},
): PaymentPublicDto {
  const dto: PaymentPublicDto = {
    id: String(payment.id),
    amount: Number(payment.amount) || 0,
    currency: (payment.currency as string) || 'IRR',
    gateway: (payment.gateway as string) || 'ZARINPAL',
    status: String(payment.status),
    authority: (payment.authority as string | null | undefined) ?? null,
    refId: (payment.refId as string | null | undefined) ?? null,
    orderId: (payment.orderId as string | null | undefined) ?? null,
    invoiceId: (payment.invoiceId as string | null | undefined) ?? null,
    paidAt: payment.paidAt
      ? payment.paidAt instanceof Date
        ? payment.paidAt.toISOString()
        : String(payment.paidAt)
      : null,
  };

  for (const key of PUBLIC_EXTRA_KEYS) {
    if (key in extras && extras[key] !== undefined) {
      (dto as Record<string, unknown>)[key] = extras[key];
    }
  }

  // Defense in depth: never leak meta even if extras/caller is hostile.
  delete (dto as Record<string, unknown>).meta;
  return dto;
}

/** Positive finite integer IRR (Rial) — rejects NaN/Infinity/floats/negatives/zero. */
export function assertPositiveFiniteIrr(
  amount: unknown,
  label = 'مبلغ',
): number {
  const n = typeof amount === 'string' ? Number(amount) : Number(amount);
  if (
    !Number.isFinite(n) ||
    Number.isNaN(n) ||
    n <= 0 ||
    !Number.isInteger(n)
  ) {
    throw new BadRequestException(`${label} باید عدد صحیح مثبت (ریال) باشد`);
  }
  return n;
}

/** Reject overpayment: paidSoFar + incoming must not exceed due (IRR integers). */
export function assertNoOverpay(
  paidSoFar: unknown,
  incoming: unknown,
  due: unknown,
  label = 'پرداخت',
): { paidSoFar: number; incoming: number; due: number } {
  const paid = assertNonNegativeFiniteIrr(paidSoFar, 'پرداخت‌شده');
  const next = assertPositiveFiniteIrr(incoming, label);
  const totalDue = assertPositiveFiniteIrr(due, 'مبلغ قابل پرداخت');
  if (paid + next > totalDue) {
    throw new BadRequestException('مبلغ پرداخت از باقیمانده فاکتور بیشتر است');
  }
  return { paidSoFar: paid, incoming: next, due: totalDue };
}

export function assertNonNegativeFiniteIrr(
  amount: unknown,
  label = 'مبلغ',
): number {
  const n = typeof amount === 'string' ? Number(amount) : Number(amount);
  if (
    !Number.isFinite(n) ||
    Number.isNaN(n) ||
    n < 0 ||
    !Number.isInteger(n)
  ) {
    throw new BadRequestException(`${label} باید عدد صحیح غیرمنفی (ریال) باشد`);
  }
  return n;
}
