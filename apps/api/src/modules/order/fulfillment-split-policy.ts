/** Post-payment parcel split — no Nest. Shipping fee stays on the parent order. */

export const FULFILLMENT_OWN_KEY = 'OWN';

export const FULFILLMENT_STATUSES = [
  'PENDING_ACCEPT',
  'ACCEPTED',
  'REJECTED',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
] as const;
export type FulfillmentStatus = (typeof FULFILLMENT_STATUSES)[number];

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

export function snapshotVendorFulfillment(product: {
  vendorId?: string | null;
  commissionPercent?: number | null;
}): { vendorId: string | null; commissionPercent: number | null } {
  const vendorId = String(product.vendorId || '').trim() || null;
  if (!vendorId) return { vendorId: null, commissionPercent: null };
  const n = product.commissionPercent == null ? null : Number(product.commissionPercent);
  const commissionPercent = n != null && Number.isInteger(n) && n >= 0 && n <= 90 ? n : 0;
  return { vendorId, commissionPercent };
}

export function vendorGroupKey(vendorId: string | null | undefined): string {
  return String(vendorId || '').trim() || FULFILLMENT_OWN_KEY;
}

export function commissionAmountIrr(lineTotal: number, percent: number | null | undefined): number {
  const total = Math.max(0, Math.floor(Number(lineTotal) || 0));
  const pct = Number(percent);
  if (!Number.isInteger(pct) || pct <= 0) return 0;
  return Math.floor((total * Math.min(90, pct)) / 100);
}

export function parcelLabelForIndex(index: number): string {
  const n = Math.max(1, Math.floor(index));
  const fa = String(n)
    .split('')
    .map((d) => PERSIAN_DIGITS[Number(d)] ?? d)
    .join('');
  return `مرسوله ${fa}`;
}

export type SplitLine = {
  id: string;
  vendorId?: string | null;
  commissionPercent?: number | null;
  totalPrice: number;
  quantity: number;
  productName: string;
  sku: string;
  color: string;
  size: string;
  imageUrl?: string | null;
};

export type SplitGroup = {
  vendorKey: string;
  vendorId: string | null;
  parcelIndex: number;
  parcelLabel: string;
  status: FulfillmentStatus;
  shippingFee: 0;
  goodsTotal: number;
  commissionTotal: number;
  items: SplitLine[];
};

/** OWN first, then partner uuids sorted — stable unlabeled parcels. */
export function splitLinesIntoParcels(lines: SplitLine[]): SplitGroup[] {
  const buckets = new Map<string, SplitLine[]>();
  for (const line of lines) {
    const key = vendorGroupKey(line.vendorId);
    const list = buckets.get(key) ?? [];
    list.push(line);
    buckets.set(key, list);
  }
  const keys = [...buckets.keys()].sort((a, b) => {
    if (a === FULFILLMENT_OWN_KEY) return -1;
    if (b === FULFILLMENT_OWN_KEY) return 1;
    return a.localeCompare(b);
  });
  return keys.map((key, i) => {
    const items = buckets.get(key) ?? [];
    const goodsTotal = items.reduce((s, it) => s + Math.floor(Number(it.totalPrice) || 0), 0);
    const commissionTotal = items.reduce(
      (s, it) => s + commissionAmountIrr(Number(it.totalPrice) || 0, it.commissionPercent),
      0,
    );
    return {
      vendorKey: key,
      vendorId: key === FULFILLMENT_OWN_KEY ? null : key,
      parcelIndex: i + 1,
      parcelLabel: parcelLabelForIndex(i + 1),
      status: (key === FULFILLMENT_OWN_KEY ? 'ACCEPTED' : 'PENDING_ACCEPT') as FulfillmentStatus,
      shippingFee: 0,
      goodsTotal,
      commissionTotal,
      items,
    };
  });
}

export function stripOrderVendorSecrets<T extends { items?: Array<Record<string, unknown>> }>(
  order: T,
): T {
  for (const item of order.items ?? []) {
    delete item.vendorId;
    delete item.commissionPercent;
  }
  return order;
}

export function partnerMayAccessFulfillment(
  actorVendorId: string | null | undefined,
  resourceVendorId: string | null | undefined,
): boolean {
  return !!actorVendorId && !!resourceVendorId && actorVendorId === resourceVendorId;
}

export function canPartnerAcceptStatus(status: string | null | undefined): boolean {
  return status === 'PENDING_ACCEPT';
}

export function canPartnerShipStatus(status: string | null | undefined): boolean {
  return status === 'ACCEPTED';
}

export function canPartnerRejectStatus(status: string | null | undefined): boolean {
  return status === 'PENDING_ACCEPT';
}

/** True when accept SLA window has ended (acceptBy in the past). */
export function isAcceptSlaExpired(
  acceptBy: Date | string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!acceptBy) return false;
  const t = acceptBy instanceof Date ? acceptBy.getTime() : new Date(acceptBy).getTime();
  if (!Number.isFinite(t)) return false;
  return t <= now.getTime();
}

export function normalizeTrackingCode(raw: unknown): string | null {
  const code = String(raw ?? '').trim().replace(/\s+/g, '');
  if (!code || code.length > 64) return null;
  return code;
}

/** Partner SMS/outbox only for vendor parcels awaiting accept — never OWN. */
export function shouldEnqueuePartnerNotify(
  vendorId: string | null | undefined,
  status: string | null | undefined,
): boolean {
  return !!vendorId && status === 'PENDING_ACCEPT';
}

export type CustomerParcel = {
  parcelIndex: number;
  parcelLabel: string;
  status: string;
  trackingCode: string | null;
  items: Array<{
    productName: string;
    sku: string;
    color: string;
    size: string;
    quantity: number;
    imageUrl: string | null;
  }>;
};

export function toCustomerParcels(
  parcels: Array<{
    parcelIndex: number;
    parcelLabel: string;
    status: string;
    trackingCode?: string | null;
    items?: Array<{
      productName: string;
      sku: string;
      color: string;
      size: string;
      quantity: number;
      imageUrl?: string | null;
    }>;
  }>,
): CustomerParcel[] {
  return parcels.map((p) => ({
    parcelIndex: p.parcelIndex,
    parcelLabel: p.parcelLabel,
    status: p.status,
    trackingCode: p.trackingCode ? String(p.trackingCode) : null,
    items: (p.items ?? []).map((it) => ({
      productName: it.productName,
      sku: it.sku,
      color: it.color,
      size: it.size,
      quantity: it.quantity,
      imageUrl: it.imageUrl ?? null,
    })),
  }));
}

