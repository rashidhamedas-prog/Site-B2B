/**
 * PR-14 PFI helpers — PROFORMA draft only from bots.
 * HARD STOP: never emit paymentMethod CREDIT from phone-only / bot auto path.
 * OrderService CREDIT create requires verifiedCustomerBinding (default false) — unused by default.
 */

import { assertQtyMeetsMoq } from './bot-order-fsm';

export type BotPfiDraftInput = {
  customerId: string;
  productId: string;
  productVariantId?: string | null;
  qty: number;
  minOrderQty: number;
  unitPrice: number;
  sku: string;
  productName: string;
  conversationId: string;
  /** Masked phone for notes only — never full mobile */
  customerPhoneMasked?: string;
  /**
   * Explicit ops flag (default false). Even when true, bot path still must not use CREDIT;
   * reserved for a future verified chat↔customer binding phase.
   */
  verifiedCustomerBinding?: boolean;
};

/** @deprecated Bot must not create CREDIT orders — kept only to assert absence in callers. */
export type BotOrderCreatePayload = {
  customerId: string;
  channel: 'WHOLESALE';
  type: 'WHOLESALE';
  /** Intentionally never CREDIT from bot helpers. */
  paymentMethod: 'ONLINE' | 'CASH';
  idempotencyKey: string;
  items: Array<{
    productId: string;
    productVariantId?: string;
    quantity: number;
    unitPrice: number;
    sku: string;
    productName: string;
  }>;
  notes: string;
};

export type BotProformaPayload = {
  customerId: string;
  orderId?: string | null;
  type: 'PROFORMA';
  subtotal: number;
  total: number;
  notes: string;
  status?: 'DRAFT';
};

export function botPfiIdempotencyKey(conversationId: string, sku: string, qty: number): string {
  return `bot-pfi:${conversationId}:${sku}:${qty}`.slice(0, 120);
}

/**
 * Build PROFORMA draft invoice payload (no Order CREDIT).
 * Phone match may supply customerId for ops linkage; never creates a credit order.
 */
export function buildBotProformaDraft(input: BotPfiDraftInput): BotProformaPayload {
  if (!assertQtyMeetsMoq(input.qty, input.minOrderQty)) {
    throw new Error('moq_reject');
  }
  if (!input.customerId) throw new Error('customer_required');
  const unit = Math.max(0, Math.floor(Number(input.unitPrice) || 0));
  const qty = Math.max(0, Math.floor(Number(input.qty) || 0));
  const subtotal = unit * qty;
  return {
    customerId: input.customerId,
    orderId: null,
    type: 'PROFORMA',
    subtotal,
    total: subtotal,
    status: 'DRAFT',
    notes:
      `bot-pfi-draft conversation=${input.conversationId}`
      + ` sku=${input.sku} qty=${qty}`
      + ` phone=${input.customerPhoneMasked || ''}`
      + ` binding=${input.verifiedCustomerBinding === true ? 'verified' : 'unverified'}`,
  };
}

/** Compat alias used by older specs — still PROFORMA only, never CREDIT. */
export function buildBotProformaPayload(input: {
  customerId: string;
  orderId?: string | null;
  subtotal: number;
  conversationId: string;
}): BotProformaPayload {
  const subtotal = Math.max(0, Math.floor(Number(input.subtotal) || 0));
  return {
    customerId: input.customerId,
    orderId: input.orderId ?? null,
    type: 'PROFORMA',
    subtotal,
    total: subtotal,
    status: 'DRAFT',
    notes: `bot-pfi conversation=${input.conversationId}`,
  };
}

/**
 * Guard: bots must not build CREDIT order payloads.
 * Throws if a caller tries to force CREDIT.
 */
export function assertBotNeverUsesCredit(paymentMethod: unknown): void {
  if (String(paymentMethod || '').toUpperCase() === 'CREDIT') {
    throw new Error('bot_credit_forbidden');
  }
}

export function formatPfiCustomerMessage(invoiceNumber: string): string {
  const num = String(invoiceNumber || '').trim();
  if (!num) return 'پیش‌فاکتور پیش‌نویس ثبت شد.';
  return `پیش‌فاکتور پیش‌نویس شما صادر شد: ${num}\nبرای نهایی‌سازی با کارشناس هماهنگ کنید (بدون ایجاد سفارش نسیه خودکار).`;
}

/** Audit/log safe: never include tokens or full phones. */
export function botPfiAuditSummary(input: {
  conversationId: string;
  orderId?: string | null;
  invoiceId?: string | null;
  invoiceNumber?: string | null;
}): Record<string, string> {
  return {
    conversationId: String(input.conversationId || ''),
    orderId: String(input.orderId || ''),
    invoiceId: String(input.invoiceId || ''),
    invoiceNumber: String(input.invoiceNumber || ''),
  };
}
