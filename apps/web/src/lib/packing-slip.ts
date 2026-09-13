import {
  composeStreetLine,
  hydrateShippingAddress,
  isValidIranPostal,
  postalDigits,
  type ShippingAddress,
} from './shipping-address';

export const PACKING_SLIP_PAGE = 'A5';

export type PackingSlipParty = {
  name: string;
  phone: string;
  address: string;
  postalCode: string;
};

export type PackingSlipLine = {
  sku: string;
  name: string;
  variant: string;
  quantity: number;
  unitToman: number;
  lineToman: number;
};

export type PackingSlipModel = {
  orderNumber: string;
  createdAt: string;
  channelLabel: string;
  shippingLabel: string;
  paymentLabel: string;
  trackingCode: string;
  notes: string;
  sender: PackingSlipParty;
  recipient: PackingSlipParty;
  lines: PackingSlipLine[];
  itemCount: number;
  subtotalToman: number;
  discountToman: number;
  shippingToman: number;
  totalToman: number;
};

const SHIP_LABEL: Record<string, string> = {
  CHAPAR: 'چاپار',
  TIPAX: 'تیپاکس',
  SNAPP: 'اسنپ‌باکس',
  POST: 'پست پیشتاز',
  PISHTAZ: 'پست پیشتاز',
  FREIGHT: 'باربری',
  TEHRAN_BIKE: 'پیک تهران',
  IN_PERSON: 'تحویل در محل',
};

const PAY_LABEL: Record<string, string> = {
  ONLINE: 'آنلاین',
  CASH: 'نقدی هنگام تحویل',
  INSTALLMENT: 'اقساط',
  CREDIT: 'اعتباری',
};

export function tomanFromIrr(n: number): number {
  return Math.round(Number(n) / 10) || 0;
}

export function formatToman(n: number): string {
  return tomanFromIrr(n).toLocaleString('fa-IR');
}

export function shipMethodLabel(method?: string): string {
  const key = String(method || '').toUpperCase();
  return SHIP_LABEL[key] || method || '—';
}

export function paymentMethodLabel(method?: string): string {
  const key = String(method || '').toUpperCase();
  return PAY_LABEL[key] || method || '—';
}

export function channelLabel(type?: string): string {
  const t = String(type || '').toUpperCase();
  return t === 'RETAIL' || t === 'RETAIL_WEBSITE' ? 'فروش تکی' : 'فروش عمده';
}

export function postalBoxes(code: string): string[] {
  const digits = postalDigits(code).padEnd(10, ' ').slice(0, 10).split('');
  return digits;
}

/** 10-digit Iranian postal only — never a mobile like 0915… pulled from an address line. */
export function extractIranPostal(raw: string): string {
  const matches = String(raw || '').match(/\d{10}/g) ?? [];
  for (const m of matches) {
    if (isValidIranPostal(m) && !m.startsWith('09')) return m;
  }
  const digits = postalDigits(raw);
  return isValidIranPostal(digits) && !digits.startsWith('09') ? digits : '';
}

function fromPartialAddress(raw?: Partial<ShippingAddress> | null): ShippingAddress {
  const hydrated = hydrateShippingAddress(raw);
  const hadProvince = Boolean(String(raw?.province || '').trim());
  const hadCity = Boolean(String(raw?.city || '').trim());
  return {
    ...hydrated,
    province: hadProvince ? hydrated.province : '',
    city: hadCity ? hydrated.city : '',
  };
}

export function parseStoredShippingAddress(raw?: string | Record<string, unknown> | null): ShippingAddress {
  if (!raw) return fromPartialAddress(null);
  if (typeof raw === 'object') return fromPartialAddress(raw as Partial<ShippingAddress>);
  const text = raw.trim();
  if (!text) return fromPartialAddress(null);
  if (text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text) as Partial<ShippingAddress>;
      if (parsed && typeof parsed === 'object') return fromPartialAddress(parsed);
    } catch {
      /* free-form line */
    }
  }
  return fromPartialAddress({ street: text, province: '', city: '' });
}

export function formatRecipientAddress(addr: ShippingAddress): string {
  const line = composeStreetLine(addr);
  return [addr.province, addr.city, line].filter(Boolean).join('، ');
}

export function formatJalaliDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fa-IR', { dateStyle: 'medium' });
}

export type SlipOrderInput = {
  orderNumber: string;
  createdAt: string;
  type?: string;
  shippingMethod?: string;
  paymentMethod?: string;
  trackingCode?: string;
  notes?: string;
  shippingAddress?: string | Record<string, unknown>;
  subtotal?: number;
  discount?: number;
  shippingFee?: number;
  total?: number;
  items?: Array<{
    productName?: string;
    sku?: string;
    color?: string;
    size?: string;
    quantity?: number;
    unitPrice?: number;
    totalPrice?: number;
  }>;
  customer?: {
    businessName?: string;
    ownerName?: string;
    phone?: string;
    city?: string;
    province?: string;
  };
};

export type SlipSenderInput = {
  businessName?: string;
  phone?: string;
  address?: string;
  officeAddress?: string;
  postalCode?: string;
  website?: string;
};

export function buildPackingSlip(order: SlipOrderInput, senderIn: SlipSenderInput): PackingSlipModel {
  const addr = parseStoredShippingAddress(order.shippingAddress);
  const customer = order.customer;
  const recipientName =
    addr.recipient || customer?.ownerName || customer?.businessName || 'گیرنده';
  const recipientPhone = addr.mobile || customer?.phone || '';
  const recipientAddress =
    formatRecipientAddress(addr) ||
    [customer?.province, customer?.city].filter(Boolean).join('، ');
  const senderAddress = String(senderIn.officeAddress || senderIn.address || '').trim();
  const lines = (order.items ?? []).map((it) => ({
    sku: String(it.sku || '—'),
    name: String(it.productName || 'کالا'),
    variant: [it.color, it.size].filter(Boolean).join(' / ') || '—',
    quantity: Number(it.quantity) || 0,
    unitToman: tomanFromIrr(Number(it.unitPrice) || 0),
    lineToman: tomanFromIrr(Number(it.totalPrice) || 0),
  }));
  return {
    orderNumber: order.orderNumber,
    createdAt: formatJalaliDate(order.createdAt),
    channelLabel: channelLabel(order.type),
    shippingLabel: shipMethodLabel(order.shippingMethod),
    paymentLabel: paymentMethodLabel(order.paymentMethod),
    trackingCode: String(order.trackingCode || '').trim(),
    notes: String(order.notes || '').trim(),
    sender: {
      name: String(senderIn.businessName || 'پوشاک ترنم').trim(),
      phone: String(senderIn.phone || '').trim(),
      address: senderAddress,
      postalCode: extractIranPostal(senderIn.postalCode || '') || extractIranPostal(senderAddress),
    },
    recipient: {
      name: recipientName,
      phone: recipientPhone,
      address: recipientAddress,
      postalCode: addr.postalCode,
    },
    lines,
    itemCount: lines.reduce((s, l) => s + l.quantity, 0),
    subtotalToman: tomanFromIrr(Number(order.subtotal) || 0),
    discountToman: tomanFromIrr(Number(order.discount) || 0),
    shippingToman: tomanFromIrr(Number(order.shippingFee) || 0),
    totalToman: tomanFromIrr(Number(order.total) || 0),
  };
}

export function canShowPackingSlip(status?: string): boolean {
  const s = String(status || '').toUpperCase();
  return ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED'].includes(s);
}
