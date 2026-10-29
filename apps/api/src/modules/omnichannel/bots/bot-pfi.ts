/**
 * PR-14 PFI helpers — bridge to OrderService + InvoiceService PROFORMA (PFI-*).
 * Pure payload builders; services perform the actual create.
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
  /** Masked phone for notes only */
  customerPhoneMasked?: string;
};

export type BotOrderCreatePayload = {
  customerId: string;
  channel: 'WHOLESALE';
  type: 'WHOLESALE';
  paymentMethod: 'CREDIT';
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
  orderId: string;
  type: 'PROFORMA';
  subtotal: number;
  total: number;
  notes: string;
};

export function botPfiIdempotencyKey(conversationId: string, sku: string, qty: number): string {
  return `bot-pfi:${conversationId}:${sku}:${qty}`.slice(0, 120);
}

export function buildBotOrderPayload(input: BotPfiDraftInput): BotOrderCreatePayload {
  if (!assertQtyMeetsMoq(input.qty, input.minOrderQty)) {
    throw new Error('moq_reject');
  }
  if (!input.customerId) throw new Error('customer_required');
  const item: BotOrderCreatePayload['items'][0] = {
    productId: input.productId,
    quantity: input.qty,
    unitPrice: input.unitPrice,
    sku: input.sku,
    productName: input.productName,
  };
  if (input.productVariantId) item.productVariantId = input.productVariantId;
  return {
    customerId: input.customerId,
    channel: 'WHOLESALE',
    type: 'WHOLESALE',
    paymentMethod: 'CREDIT',
    idempotencyKey: botPfiIdempotencyKey(input.conversationId, input.sku, input.qty),
    items: [item],
    notes: `omnichannel-bot conversation=${input.conversationId} phone=${input.customerPhoneMasked || ''}`,
  };
}

export function buildBotProformaPayload(input: {
  customerId: string;
  orderId: string;
  subtotal: number;
  conversationId: string;
}): BotProformaPayload {
  const subtotal = Math.max(0, Math.floor(Number(input.subtotal) || 0));
  return {
    customerId: input.customerId,
    orderId: input.orderId,
    type: 'PROFORMA',
    subtotal,
    total: subtotal,
    notes: `bot-pfi conversation=${input.conversationId}`,
  };
}

export function formatPfiCustomerMessage(invoiceNumber: string): string {
  const num = String(invoiceNumber || '').trim();
  if (!num) return 'پیش‌فاکتور ثبت شد.';
  return `پیش‌فاکتور شما صادر شد: ${num}\nبرای نهایی‌سازی با کارشناس هماهنگ کنید.`;
}

/** Audit/log safe: never include tokens. */
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
