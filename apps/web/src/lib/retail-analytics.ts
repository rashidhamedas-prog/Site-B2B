'use client';

import { hostLooksRetail } from './channel';
import {
  ga4EnvFor,
  ensureGtagStub,
  isAdminAnalyticsPath,
  isNonProductionAnalyticsHost,
  publicAnalyticsPagePath,
  RETAIL_GA4_MEASUREMENT_ID,
  WHOLESALE_GA4_MEASUREMENT_ID,
  sanitizeAnalyticsSearch,
  sanitizeGa4Id,
  stripRetailInternalPath,
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
  affiliation?: 'affiliate';
  affiliate_network?: string;
  affiliate_code?: string;
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
  const hasWindow = typeof window !== 'undefined';
  if (!hasWindow && opts?.host == null) return false;
  const host = opts?.host ?? (hasWindow ? window.location.hostname : '');
  const pathname = opts?.pathname ?? (hasWindow ? window.location.pathname : '');
  if (isNonProductionAnalyticsHost(host)) return false;
  if (isAdminAnalyticsPath(pathname)) return false;
  // Explicit WHOLESALE: allow ecommerce on wholesale hosts (.com).
  if (opts?.channel === 'WHOLESALE') return !hostLooksRetail(host);
  if (!hostLooksRetail(host)) return false;
  return true;
}

export function shouldSendWholesaleAnalytics(opts?: {
  host?: string | null;
  pathname?: string | null;
}): boolean {
  return shouldSendRetailAnalytics({ ...opts, channel: 'WHOLESALE' });
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

function resolveEcommerceGa4Id(channel: GoogleChannel): string {
  if (channel === 'WHOLESALE') return resolveWholesaleGa4Id();
  return resolveRetailGa4Id();
}

function ecommerceEvent(name: string, params: Record<string, unknown>) {
  try {
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    const channel: GoogleChannel = hostLooksRetail(host) ? 'RETAIL' : 'WHOLESALE';
    if (!shouldSendRetailAnalytics({ channel: channel === 'WHOLESALE' ? 'WHOLESALE' : undefined })) {
      return;
    }
    const items = Array.isArray(params.items) ? params.items : undefined;
    const gtagParams: Record<string, unknown> = { ...params, currency: GA4_CURRENCY };
    if (items) gtagParams.items = items;
    const sendTo = resolveEcommerceGa4Id(channel);
    if (sendTo) gtagParams.send_to = sendTo;
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

export function trackSelectItem(input: RetailAnalyticsItemInput, listName?: string, listId?: string) {
  const item = toGa4Item({ ...input, itemListName: listName, itemListId: listId });
  if (!item) return;
  ecommerceEvent('select_item', {
    item_list_id: listId,
    item_list_name: listName,
    items: [item],
  });
}

export function trackAddToWishlist(input: RetailAnalyticsItemInput) {
  const item = toGa4Item(input);
  if (!item) return;
  ecommerceEvent('add_to_wishlist', {
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

const checkoutSteps = new Set<string>();
const CHECKOUT_STEP_STORAGE_PREFIX = 'taranom_ga4_checkout_step:';

export function checkoutCartFingerprint(
  items: Array<{ sku?: string; productId?: string; quantity?: number; unitPrice?: number; price?: number }>,
): string {
  return items
    .map((item) => `${item.sku || item.productId || ''}:${item.quantity || 1}:${item.unitPrice ?? item.price ?? 0}`)
    .join(',');
}

function checkoutStepStorageKey(eventName: string, fingerprint: string, selection: string): string {
  return `${CHECKOUT_STEP_STORAGE_PREFIX}${eventName}|${fingerprint}|${selection}`;
}

/** Returns true the first time this cart and selection are seen (memory + sessionStorage). */
export function claimCheckoutStep(eventName: string, fingerprint: string, selection: string): boolean {
  const key = `${eventName}|${fingerprint}|${selection}`;
  if (!eventName || !selection || !fingerprint) return false;
  if (checkoutSteps.has(key)) return false;
  try {
    if (typeof window !== 'undefined') {
      const storageKey = checkoutStepStorageKey(eventName, fingerprint, selection);
      if (window.sessionStorage?.getItem(storageKey)) {
        checkoutSteps.add(key);
        return false;
      }
      window.sessionStorage?.setItem(storageKey, '1');
    }
  } catch {
    /* private mode — memory dedupe still applies */
  }
  checkoutSteps.add(key);
  return true;
}

/** begin_checkout once per cart fingerprint per session (not on page mount). */
export function claimBeginCheckout(fingerprint: string): boolean {
  return claimCheckoutStep('begin_checkout', fingerprint, 'start');
}

export function inferRetailItemList(pathname: string, search = ''): { id: string; name: string } {
  const path = stripRetailInternalPath((pathname || '/').split('?')[0]);
  const raw = new URLSearchParams(String(search || '').replace(/^\?/, '').split('#')[0] || '');
  const params = new URLSearchParams(sanitizeAnalyticsSearch(search));
  if (params.get('q') || params.get('query') || params.get('search')) {
    return { id: 'search', name: 'search' };
  }
  if (raw.get('collectionId') || raw.get('collection') || path.startsWith('/collection')) {
    return { id: 'collection', name: 'collection' };
  }
  if (path.startsWith('/category/')) return { id: path, name: 'category' };
  if (path.startsWith('/collection')) return { id: path, name: 'collection' };
  if (/^\/products\/[^/]+$/.test(path)) return { id: 'related', name: 'related' };
  return { id: 'products', name: 'products' };
}

export function trackSelectCurrentItem(input: RetailAnalyticsItemInput) {
  if (typeof window === 'undefined') return;
  const list = inferRetailItemList(window.location.pathname, window.location.search);
  trackSelectItem({ ...input, itemListId: list.id, itemListName: list.name }, list.name, list.id);
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
  const fingerprint = checkoutCartFingerprint(inputs);
  if (!claimBeginCheckout(fingerprint)) return;
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
  const tier = String(shippingTier || '').trim();
  if (!tier) return;
  if (!claimCheckoutStep('add_shipping_info', checkoutCartFingerprint(inputs), tier)) return;
  const items = inputs
    .map((it, i) => toGa4Item(it, i))
    .filter((it): it is Ga4Item => Boolean(it));
  ecommerceEvent('add_shipping_info', {
    currency: GA4_CURRENCY,
    value: ga4ValueFromStoredIrr(valueIrr),
    shipping_tier: tier,
    items,
  });
}

export function trackAddPaymentInfo(
  inputs: RetailAnalyticsItemInput[],
  valueIrr: number,
  paymentType: string,
) {
  const payment = String(paymentType || '').trim();
  if (!payment) return;
  if (!claimCheckoutStep('add_payment_info', checkoutCartFingerprint(inputs), payment)) return;
  const items = inputs
    .map((it, i) => toGa4Item(it, i))
    .filter((it): it is Ga4Item => Boolean(it));
  ecommerceEvent('add_payment_info', {
    currency: GA4_CURRENCY,
    value: ga4ValueFromStoredIrr(valueIrr),
    payment_type: payment,
    items,
  });
}

export function affiliatePurchaseParams(input: { network?: string; code?: string }): {
  affiliation?: 'affiliate';
  affiliate_network?: string;
  affiliate_code?: string;
} {
  const out: {
    affiliation?: 'affiliate';
    affiliate_network?: string;
    affiliate_code?: string;
  } = {};
  const network = String(input.network || '').trim().toLowerCase();
  if (network && network.length <= 32 && !/@/.test(network) && !/09\d{9}/.test(network)) {
    out.affiliate_network = network;
  }
  const code = String(input.code || '').trim();
  if (code && code.length <= 40 && !/@/.test(code) && !/09\d{9}/.test(code) && !/\+98/.test(code)) {
    out.affiliate_code = code;
  }
  if (out.affiliate_network || out.affiliate_code) out.affiliation = 'affiliate';
  return out;
}

export function buildPurchasePayload(opts: {
  transactionId: string;
  valueIrr: number;
  items: RetailAnalyticsItemInput[];
  shippingIrr?: number;
  taxIrr?: number;
  coupon?: string;
  affiliation?: string;
  affiliateNetwork?: string;
  affiliateCode?: string;
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
  if (coupon && !PII_PARAM_VALUE.test(coupon)) payload.coupon = coupon;
  const affiliate = affiliatePurchaseParams({
    network: opts.affiliateNetwork,
    code: opts.affiliateCode,
  });
  if (affiliate.affiliation) payload.affiliation = affiliate.affiliation;
  if (affiliate.affiliate_network) payload.affiliate_network = affiliate.affiliate_network;
  if (affiliate.affiliate_code) payload.affiliate_code = affiliate.affiliate_code;
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
  affiliateNetwork?: string;
  affiliateCode?: string;
}) {
  const payload = buildPurchasePayload(opts);
  if (!payload) return;
  const ids = [payload.transaction_id, ...(opts.extraTransactionIds ?? [])]
    .map((id) => String(id || '').trim())
    .filter(Boolean);
  if (ids.some((id) => hasPurchaseBeenFired(id))) return;
  // Host-aware: retail on .ir, wholesale on .com (both after backend verify only).
  if (!shouldSendRetailAnalytics() && !shouldSendWholesaleAnalytics()) return;
  ecommerceEvent('purchase', payload);
  for (const id of ids) markPurchaseFired(id);
  clearPendingRetailPurchase();
}

const CONTACT_METHODS = new Set(['phone', 'sms', 'whatsapp', 'telegram', 'instagram', 'rubika', 'bale']);

const AFFILIATE_EVENTS = new Set([
  'affiliate_landing_view',
  'affiliate_signup_start',
  'affiliate_link_created',
  'affiliate_link_copied',
  'affiliate_catalog_view',
  'affiliate_order_created',
  'affiliate_payment_link_sent',
]);

const PII_PARAM_KEY = /phone|mobile|email|name|address|token|otp|national|card|iban|password|authority/i;
const PII_PARAM_VALUE = /@|09\d{9}|\+98\d{10}/;

export function sanitizeEventParams(
  params: Record<string, unknown>,
): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [key, raw] of Object.entries(params)) {
    if (PII_PARAM_KEY.test(key)) continue;
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      out[key] = raw;
      continue;
    }
    if (typeof raw !== 'string' && typeof raw !== 'boolean') continue;
    const value = String(raw).trim();
    if (!value || value.length > 80 || PII_PARAM_VALUE.test(value)) continue;
    out[key] = value;
  }
  return out;
}

function plainEvent(name: string, params: Record<string, unknown>) {
  if (!shouldSendRetailAnalytics()) return;
  const safe = sanitizeEventParams(params);
  const sendTo = resolveRetailGa4Id();
  const payload: Record<string, unknown> = { ...safe };
  if (sendTo) payload.send_to = sendTo;
  gtagEvent(name, payload);
}

export function trackSearch(term: string) {
  const search_term = String(term ?? '').trim().slice(0, 80);
  if (!search_term || PII_PARAM_VALUE.test(search_term)) return;
  plainEvent('search', { search_term });
}

export function trackContactClick(contactMethod: string) {
  const contact_method = String(contactMethod ?? '').trim().toLowerCase();
  if (!CONTACT_METHODS.has(contact_method)) return;
  plainEvent('contact_click', { contact_method });
}

export function trackPartnerAuth(name: 'sign_up' | 'login') {
  plainEvent(name, { method: 'sales_partner' });
}

export function trackAffiliateEvent(
  name:
    | 'affiliate_landing_view'
    | 'affiliate_signup_start'
    | 'affiliate_link_created'
    | 'affiliate_link_copied'
    | 'affiliate_catalog_view'
    | 'affiliate_order_created'
    | 'affiliate_payment_link_sent',
  /** Optional opaque id (e.g. draft id) so resend/refresh does not duplicate the event. */
  dedupeKey?: string,
) {
  if (!AFFILIATE_EVENTS.has(name)) return;
  if (dedupeKey && !claimCheckoutStep(name, String(dedupeKey).slice(0, 64), 'once')) return;
  plainEvent(name, { sales_channel: 'affiliate' });
}

export function publicRetailPagePath(): string {
  if (typeof window === 'undefined') return '/';
  return publicAnalyticsPagePath(window.location.pathname, window.location.search);
}

export function resolveRetailGa4Id(fromSettings?: string | null): string {
  return sanitizeGa4Id(fromSettings) || ga4EnvFor('RETAIL') || RETAIL_GA4_MEASUREMENT_ID;
}

export function resolveWholesaleGa4Id(fromSettings?: string | null): string {
  return sanitizeGa4Id(fromSettings) || ga4EnvFor('WHOLESALE') || WHOLESALE_GA4_MEASUREMENT_ID;
}

/** Read GA4 client_id from the `_ga` cookie for Measurement Protocol attribution. */
export function readGa4ClientId(): string | undefined {
  try {
    if (typeof document === 'undefined') return undefined;
    const match = document.cookie.match(/(?:^|; )_ga=([^;]+)/);
    if (!match?.[1]) return undefined;
    const raw = decodeURIComponent(match[1]);
    // Format: GA1.1.XXXXXXXXXX.YYYYYYYYYY
    const parts = raw.split('.');
    if (parts.length >= 4) return `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
    return undefined;
  } catch {
    return undefined;
  }
}

/** GA4 session id from `_ga_<STREAM>` (GS1 and GS2 cookie formats). */
export function readGa4SessionId(measurementId: string): string | undefined {
  try {
    if (typeof document === 'undefined') return undefined;
    const suffix = String(measurementId || '').replace(/^G-/, '');
    if (!suffix) return undefined;
    const match = document.cookie.match(new RegExp(`(?:^|; )_ga_${suffix}=([^;]+)`));
    if (!match?.[1]) return undefined;
    return parseGa4SessionCookie(decodeURIComponent(match[1]));
  } catch {
    return undefined;
  }
}

export function parseGa4SessionCookie(raw: string): string | undefined {
  const v = String(raw || '');
  const gs2 = v.match(/^GS2\.\d+\.s(\d{6,14})/);
  if (gs2) return gs2[1];
  const parts = v.split('.');
  if (parts[0] === 'GS1' && /^\d{6,14}$/.test(parts[2] || '')) return parts[2];
  return undefined;
}

const WHOLESALE_LEAD_EVENTS = new Set([
  'generate_lead',
  'wholesale_cta_click',
  'phone_click',
  'telegram_click',
  'whatsapp_click',
  'contact_form_start',
  'contact_form_submit',
  'wholesale_order_request',
]);

export function trackWholesaleLead(
  name: string,
  params: Record<string, unknown> = {},
) {
  if (!WHOLESALE_LEAD_EVENTS.has(name)) return;
  if (!shouldSendWholesaleAnalytics()) return;
  try {
    const safe = sanitizeEventParams({
      ...params,
      page_path: publicRetailPagePath(),
    });
    const sendTo = resolveWholesaleGa4Id();
    const payload: Record<string, unknown> = { ...safe, lead_type: name };
    if (sendTo) payload.send_to = sendTo;
    gtagEvent(name, payload);
  } catch {
    /* never throw into UI */
  }
}
