import {
  formatRecipientAddress,
  parseStoredShippingAddress,
  paymentMethodLabel,
  tomanFromIrr,
} from './packing-slip';

const PLACEHOLDER_NAMES = new Set(['خریدار ترنم', 'نامشخص']);

export type OrderPartyInput = {
  id?: string;
  orderNumber?: string;
  shippingAddress?: string | Record<string, unknown> | null;
  customer?: {
    id?: string;
    businessName?: string;
    ownerName?: string;
    phone?: string;
    city?: string;
    province?: string;
  } | null;
};

export type RecipientSnapshot = {
  name: string;
  phone: string;
  address: string;
  postalCode: string;
  customerId: string;
  profileName: string;
  profilePlace: string;
  hasDelivery: boolean;
};

export type PaymentRow = {
  orderId?: string | null;
  gateway?: string | null;
  status?: string | null;
  refId?: string | null;
  paidAt?: string | null;
  amount?: number | null;
};

export type SettlementView = {
  headline: string;
  statusLabel: string;
  refId: string;
  paidAt: string;
  amountToman: number;
};

const GATEWAY_LABEL: Record<string, string> = {
  ZARINPAL: 'زرین‌پال',
  DIGIPAY: 'دیجی‌پی',
  TOROBPAY: 'ترب‌پی',
  MANUAL: 'ثبت دستی',
  CARD_TO_CARD: 'کارت‌به‌کارت',
};

const STATUS_LABEL: Record<string, string> = {
  PAID: 'تسویه‌شده',
  PENDING: 'در انتظار تأیید درگاه',
  FAILED: 'ناموفق',
  CANCELLED: 'لغو شده',
  REFUNDED: 'بازگشت‌شده',
};

const STATUS_RANK: Record<string, number> = {
  PAID: 5,
  REFUNDED: 4,
  PENDING: 3,
  FAILED: 1,
  CANCELLED: 0,
};

export const PAYMENT_METHOD_OPTIONS = [
  { id: 'ONLINE', label: 'آنلاین' },
  { id: 'CASH', label: 'نقدی هنگام تحویل' },
  { id: 'INSTALLMENT', label: 'اقساط' },
  { id: 'CREDIT', label: 'اعتباری' },
] as const;

function usableName(raw: string | undefined, phone: string): string {
  const name = String(raw || '').trim();
  if (!name || PLACEHOLDER_NAMES.has(name)) return '';
  if (phone && name === phone) return '';
  return name;
}

export function recipientSnapshot(order: OrderPartyInput): RecipientSnapshot {
  const addr = parseStoredShippingAddress(order.shippingAddress);
  const customer = order.customer ?? undefined;
  const profilePhone = String(customer?.phone || '').trim();
  const profileName =
    usableName(customer?.ownerName, profilePhone) || usableName(customer?.businessName, profilePhone);
  const name = addr.recipient.trim() || profileName;
  const phone = String(addr.mobile || '').trim() || profilePhone;
  const address = formatRecipientAddress(addr);
  const profilePlace = [customer?.province, customer?.city]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join('، ');
  return {
    name,
    phone,
    address,
    postalCode: addr.postalCode,
    customerId: String(customer?.id || '').trim(),
    profileName,
    profilePlace,
    hasDelivery: Boolean(name || phone || address || addr.postalCode),
  };
}

export function asPaymentRows(payload: unknown): PaymentRow[] {
  if (Array.isArray(payload)) return payload as PaymentRow[];
  if (payload && typeof payload === 'object' && Array.isArray((payload as { data?: unknown }).data)) {
    return (payload as { data: PaymentRow[] }).data;
  }
  return [];
}

export function pickOrderPayment(rows: PaymentRow[] | null | undefined, orderId: string): PaymentRow | null {
  const id = String(orderId || '').trim();
  if (!id) return null;
  const matches = (rows || []).filter((row) => String(row.orderId || '') === id);
  if (matches.length === 0) return null;
  return [...matches].sort((a, b) => {
    const rankA = STATUS_RANK[String(a.status || '').toUpperCase()] ?? 2;
    const rankB = STATUS_RANK[String(b.status || '').toUpperCase()] ?? 2;
    return rankB - rankA;
  })[0]!;
}

export function describeSettlement(input: {
  paymentMethod?: string;
  payments?: PaymentRow[] | null;
  orderId?: string;
}): SettlementView {
  const method = paymentMethodLabel(input.paymentMethod);
  const picked = input.orderId ? pickOrderPayment(input.payments, input.orderId) : null;
  const gateway = GATEWAY_LABEL[String(picked?.gateway || '').toUpperCase()] || '';
  const statusLabel = STATUS_LABEL[String(picked?.status || '').toUpperCase()] || '';
  const headline = gateway || (method === '—' ? '' : method);
  return {
    headline,
    statusLabel,
    refId: String(picked?.refId || '').trim(),
    paidAt: picked?.paidAt ? String(picked.paidAt) : '',
    amountToman: picked?.amount != null ? tomanFromIrr(Number(picked.amount)) : 0,
  };
}

export function orderDeliveryAddresses(
  orders: OrderPartyInput[],
): Array<{
  orderId: string;
  orderNumber: string;
  name: string;
  phone: string;
  address: string;
  postalCode: string;
}> {
  const seen = new Set<string>();
  const rows: Array<{
    orderId: string;
    orderNumber: string;
    name: string;
    phone: string;
    address: string;
    postalCode: string;
  }> = [];
  for (const order of orders) {
    const snap = recipientSnapshot(order);
    if (!snap.address && !snap.postalCode) continue;
    const key = `${snap.name}|${snap.phone}|${snap.address}|${snap.postalCode}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      orderId: String(order.id || ''),
      orderNumber: String(order.orderNumber || ''),
      name: snap.name,
      phone: snap.phone,
      address: snap.address,
      postalCode: snap.postalCode,
    });
  }
  return rows;
}
