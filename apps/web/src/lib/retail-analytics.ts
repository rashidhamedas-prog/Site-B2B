'use client';

import { hostLooksRetail } from './channel';
import {
  ga4EnvFor,
  ensureGtagStub,
  isAdminAnalyticsPath,
  isNonProductionAnalyticsHost,
  publicAnalyticsPagePath,
  sanitizeGa4Id,
  type GoogleChannel,
} from './google';

export const GA4_CURRENCY = 'IRR' as const;
export const RETAIL_ITEM_BRAND = 'Taranom';

const PENDING_PURCHASE_KEY = 'taranom_ga4_pending_purchase';
const PURCHASE_DEDUP_PREFIX = 'taranom_ga4_purchase:';

export type Ga4Item = {
  item_id: string;
  item_name: string;
  item_brand: string;
  item_category?: string;
  item_variant?: string;
  price: number;
  quantity: number;
  discount?: number;
  index?: number;
  item_list_id?: string;
  item_list_name?: string;
};

export type RetailAnalyticsItemInput = {
  productId?: string;
  sku?: string;
  name?: string;
  productName?: string;
  category?: string;
  color?: string;
  size?: string;
  price?: number;
  unitPrice?: number;
  quantity?: number;
  discount?: number;
  index?: number;
  itemListId?: string;
  itemListName?: string;
};

type PurchasePayload = {
  transaction_id: string;
  currency: typeof GA4_CURRENCY;
  value: number;
  items: Ga4Item[];
  shipping?: number;
  tax?: number;
  coupon?: string;
};

export type PendingRetailPurchase = {
  transactionIds: string[];
  value: number;
  items: Ga4Item[];
  shipping?: number;
};

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const firedPurchases = new Set<string>();

/** Stored catalog/cart/order amounts are IRR (Rial). Display divides by 10 for Toman. */
export function ga4ValueFromStoredIrr(amountIrr: number | null | undefined): number {
  const n = Number(amountIrr);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
}

export function itemVariant(color?: string | null, size?: string | null): string | undefined {
  const parts = [color, size].map((v) => String(v ?? '').trim()).filter(Boolean);
  return parts.length ? parts.join(' / ') : undefined;
}

export function toGa4Item(input: RetailAnalyticsItemInput, index?: number): Ga4Item | null {
  const itemId = String(input.sku || input.productId || '').trim();
  const name = String(input.name || input.productName || '').trim();
  if (!itemId && !name) return null;
  const price = ga4ValueFromStoredIrr(input.price ?? input.unitPrice);
  const quantity = Math.max(1, Math.round(Number(input.quantity) || 1));
  const discount = ga4ValueFromStoredIrr(input.discount);
  const item: Ga4Item = {
    item_id: itemId || name,
    item_name: name || itemId,
    item_brand: RETAIL_ITEM_BRAND,
    price,
    quantity,
  };
  const category = String(input.category ?? '').trim();
  if (category) item.item_category = category;
  const variant = itemVariant(input.color, input.size);
  if (variant) item.item_variant = variant;
  if (discount > 0) item.discount = discount;
  const idx = index ?? input.index;
  if (typeof idx === 'number' && Number.isFinite(idx)) item.index = idx;
  if (input.itemListId) item.item_list_id = input.itemListId;
  if (input.itemListName) item.item_list_name = input.itemListName;
  return item;
}

export function shouldSendRetailAnalytics(opts?: {
  host?: string | null;
  pathname?: string | null;
  channel?: GoogleChannel;
}): boolean {
  if (typeof window === 'undefined') return false;
  const host = opts?.host ?? window.location.hostname;
  const pathname = opts?.pathname ?? window.location.pathname;
  if (isNonProductionAnalyticsHost(host)) return false;
  if (isAdminAnalyticsPath(pathname)) return false;
  if (opts?.channel === 'WHOLESALE') return false;
  if (!hostLooksRetail(host)) return false;
  return true;
}

function dataLayerPush(entry: Record<string, unknown>) {
  try {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(entry);
  } catch {
    /* adblock / deny */
  }
}

function gtagEvent(name: string, params: Record<string, unknown>) {
  try {
    ensureGtagStub();
    if (typeof window.gtag === 'function') {
      window.gtag('event', name, params);
    }
  } catch {
    /* adblock / deny */
  }
}

function ecommerceEvent(name: string, params: Record<string, unknown>) {
  try {
    if (!shouldSendRetailAnalytics()) return;
    const items = Array.isArray(params.items) ? params.items : undefined;
    dataLayerPush({ ecommerce: null });
    dataLayerPush({
      event: name,
      ecommerce: params,
    });
    const gtagParams: Record<string, unknown> = { ...params, currency: GA4_CURRENCY };
    if (items) gtagParams.items = items;
    gtagEvent(name, gtagParams);
  } catch {
    /* never throw into storefront UI */
  }
}

export function trackRetailEvent(name: string, params: Record<string, unknown> = {}) {
  if (!shouldSendRetailAnalytics()) return;
  if (!name || name === 'purchase') return;
  try {
    ecommerceEvent(name, params);
  } catch {
    /* never throw into UI */
  }
}

export function trackViewItem(input: RetailAnalyticsItemInput) {
  const item = toGa4Item(input);
  if (!item) return;
  ecommerceEvent('view_item', {
    currency: GA4_CURRENCY,
    value: item.price * item.quantity,
    items: [item],
  });
}

export function trackViewItemList(items: RetailAnalyticsItemInput[], listName: string, listId?: string) {
  const gaItems = items
    .map((it, i) => toGa4Item({ ...it, itemListName: listName, itemListId: listId }, i))
    .filter((it): it is Ga4Item => Boolean(it));
  if (!gaItems.length) return;
  ecommerceEvent('view_item_list', {
    item_list_id: listId,
    item_list_name: listName,
    items: gaItems,
  });
}

export function trackAddToCart(input: RetailAnalyticsItemInput) {
  const item = toGa4Item(input);
  if (!item) return;
  ecommerceEvent('add_to_cart', {
    currency: GA4_CURRENCY,
    value: item.price * item.quantity,
    items: [item],
  });
}

export function trackRemoveFromCart(input: RetailAnalyticsItemInput) {
  const item = toGa4Item(input);
  if (!item) return;
  ecommerceEvent('remove_from_cart', {
    currency: GA4_CURRENCY,
    value: item.price * item.quantity,
    items: [item],
  });
}

export function trackViewCart(inputs: RetailAnalyticsItemInput[], valueIrr: number) {
  const items = inputs
    .map((it, i) => toGa4Item(it, i))
    .filter((it): it is Ga4Item => Boolean(it));
  ecommerceEvent('view_cart', {
    currency: GA4_CURRENCY,
    value: ga4ValueFromStoredIrr(valueIrr),
    items,
  });
}

export function trackBeginCheckout(inputs: RetailAnalyticsItemInput[], valueIrr: number) {
  const items = inputs
    .map((it, i) => toGa4Item(it, i))
    .filter((it): it is Ga4Item => Boolean(it));
  ecommerceEvent('begin_checkout', {
    currency: GA4_CURRENCY,
    value: ga4ValueFromStoredIrr(valueIrr),
    items,
  });
}

export function trackAddShippingInfo(
  inputs: RetailAnalyticsItemInput[],
  valueIrr: number,
  shippingTier: string,
) {
  const items = inputs
    .map((it, i) => toGa4Item(it, i))
    .filter((it): it is Ga4Item => Boolean(it));
  ecommerceEvent('add_shipping_info', {
    currency: GA4_CURRENCY,
    value: ga4ValueFromStoredIrr(valueIrr),
    shipping_tier: shippingTier,
    items,
  });
}

export function trackAddPaymentInfo(
  inputs: RetailAnalyticsItemInput[],
  valueIrr: number,
  paymentType: string,
) {
  const items = inputs
    .map((it, i) => toGa4Item(it, i))
    .filter((it): it is Ga4Item => Boolean(it));
  ecommerceEvent('add_payment_info', {
    currency: GA4_CURRENCY,
    value: ga4ValueFromStoredIrr(valueIrr),
    payment_type: paymentType,
    items,
  });
}

export function buildPurchasePayload(opts: {
  transactionId: string;
  valueIrr: number;
  items: RetailAnalyticsItemInput[];
  shippingIrr?: number;
  taxIrr?: number;
  coupon?: string;
}): PurchasePayload | null {
  const transaction_id = String(opts.transactionId || '').trim();
  if (!transaction_id) return null;
  const items = opts.items
    .map((it, i) => toGa4Item(it, i))
    .filter((it): it is Ga4Item => Boolean(it));
  const payload: PurchasePayload = {
    transaction_id,
    currency: GA4_CURRENCY,
    value: ga4ValueFromStoredIrr(opts.valueIrr),
    items,
  };
  const shipping = ga4ValueFromStoredIrr(opts.shippingIrr);
  if (shipping > 0) payload.shipping = shipping;
  const tax = ga4ValueFromStoredIrr(opts.taxIrr);
  if (tax > 0) payload.tax = tax;
  const coupon = String(opts.coupon ?? '').trim();
  if (coupon) payload.coupon = coupon;
  return payload;
}

export function hasPurchaseBeenFired(transactionId: string): boolean {
  const id = String(transactionId || '').trim();
  if (!id) return true;
  if (firedPurchases.has(id)) return true;
  try {
    if (typeof window !== 'undefined') {
      if (window.sessionStorage?.getItem(PURCHASE_DEDUP_PREFIX + id)) return true;
      if (window.localStorage?.getItem(PURCHASE_DEDUP_PREFIX + id)) return true;
    }
  } catch {
    /* private mode */
  }
  return false;
}

export function markPurchaseFired(transactionId: string) {
  const id = String(transactionId || '').trim();
  if (!id) return;
  firedPurchases.add(id);
  try {
    if (typeof window !== 'undefined') {
      window.sessionStorage?.setItem(PURCHASE_DEDUP_PREFIX + id, '1');
      window.localStorage?.setItem(PURCHASE_DEDUP_PREFIX + id, '1');
    }
  } catch {
    /* private mode */
  }
}

export function stashPendingRetailPurchase(pending: PendingRetailPurchase) {
  try {
    if (typeof window === 'undefined') return;
    const ids = pending.transactionIds.map((id) => String(id || '').trim()).filter(Boolean);
    if (!ids.length) return;
    window.sessionStorage.setItem(
      PENDING_PURCHASE_KEY,
      JSON.stringify({ ...pending, transactionIds: ids }),
    );
  } catch {
    /* ignore */
  }
}

export function readPendingRetailPurchase(): PendingRetailPurchase | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.sessionStorage.getItem(PENDING_PURCHASE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingRetailPurchase;
    if (!parsed || !Array.isArray(parsed.transactionIds)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingRetailPurchase() {
  try {
    if (typeof window === 'undefined') return;
    window.sessionStorage.removeItem(PENDING_PURCHASE_KEY);
  } catch {
    /* ignore */
  }
}

export function trackPurchase(opts: {
  transactionId: string;
  valueIrr: number;
  items: RetailAnalyticsItemInput[];
  shippingIrr?: number;
  extraTransactionIds?: string[];
}) {
  const payload = buildPurchasePayload(opts);
  if (!payload) return;
  const ids = [payload.transaction_id, ...(opts.extraTransactionIds ?? [])]
    .map((id) => String(id || '').trim())
    .filter(Boolean);
  if (ids.some((id) => hasPurchaseBeenFired(id))) return;
  if (!shouldSendRetailAnalytics()) return;
  ecommerceEvent('purchase', payload);
  for (const id of ids) markPurchaseFired(id);
  clearPendingRetailPurchase();
}

export function publicRetailPagePath(): string {
  if (typeof window === 'undefined') return '/';
  return publicAnalyticsPagePath(window.location.pathname, window.location.search);
}

export function resolveRetailGa4Id(fromSettings?: string | null): string {
  return sanitizeGa4Id(fromSettings) || ga4EnvFor('RETAIL');
}
