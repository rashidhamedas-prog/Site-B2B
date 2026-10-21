'use client';

import { hostLooksRetail } from './channel';
import {
  ga4EnvFor,
  ensureGtagStub,
  isAdminAnalyticsPath,
  isNonProductionAnalyticsHost,
  looksLikePii,
  publicAnalyticsPagePath,
  RETAIL_GA4_MEASUREMENT_ID,
  WHOLESALE_GA4_MEASUREMENT_ID,
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

const LEAD_EVENT_NAMES = [
  'generate_lead',
  'wholesale_cta_click',
  'phone_click',
  'telegram_click',
  'whatsapp_click',
  'contact_form_start',
  'contact_form_submit',
  'wholesale_order_request',
] as const;

/** Allowed values (lowercase, matched case-insensitively) for enum params. Anything else is dropped. */
export const EVENT_PARAM_ENUMS: Record<string, ReadonlySet<string>> = {
  lead_type: new Set<string>(LEAD_EVENT_NAMES),
  cta_location: new Set([
    'floating_contact',
    'page_link',
    'checkout_submit',
    'portal_register',
    'catalog_quick_order',
  ]),
  business_type: new Set(['retail', 'boutique', 'wholesale', 'online']),
  referral: new Set(['yes', 'no']),
  payment_type: new Set(['online', 'cash', 'installment', 'zarinpal', 'digipay', 'torobpay']),
  contact_method: new Set(['phone', 'sms', 'whatsapp', 'telegram', 'instagram', 'rubika', 'bale']),
  method: new Set(['sales_partner']),
  sales_channel: new Set(['affiliate']),
  affiliation: new Set(['affiliate']),
  currency: new Set([GA4_CURRENCY.toLowerCase()]),
  cart_age_bucket: new Set(['same_day', '1_3_days', '4_7_days', '8_plus_days']),
};

const LEAD_PARAMS = ['lead_type', 'cta_location', 'business_type', 'referral', 'payment_type'] as const;
/**
 * GA4 Admin: `cart_age_bucket` = event-scoped custom dimension (4 values); `cart_age_days` = custom
 * metric only. `cart_fp` is for dedupe/exploration and must never become a custom dimension.
 */
const CART_COHORT_PARAMS = ['cart_fp', 'cart_age_days', 'cart_age_bucket'] as const;
const AFFILIATE_PARAMS = ['sales_channel'] as const;

/**
 * Single source of truth for what each event may carry. Events not listed are not sent;
 * keys not listed are dropped. `send_to` is added by the choke point after filtering.
 */
export const EVENT_PARAM_ALLOWLIST: Record<string, readonly string[]> = {
  view_item: ['currency', 'value', 'items'],
  view_item_list: ['currency', 'item_list_id', 'item_list_name', 'items'],
  select_item: ['currency', 'item_list_id', 'item_list_name', 'items'],
  add_to_wishlist: ['currency', 'value', 'items'],
  add_to_cart: ['currency', 'value', 'items', ...CART_COHORT_PARAMS],
  remove_from_cart: ['currency', 'value', 'items'],
  view_cart: ['currency', 'value', 'items'],
  begin_checkout: ['currency', 'value', 'items', 'coupon', ...CART_COHORT_PARAMS],
  add_shipping_info: ['currency', 'value', 'items', 'coupon', 'shipping_tier', ...CART_COHORT_PARAMS],
  add_payment_info: ['currency', 'value', 'items', 'coupon', 'payment_type', ...CART_COHORT_PARAMS],
  purchase: [
    'transaction_id',
    'currency',
    'value',
    'items',
    'shipping',
    'tax',
    'coupon',
    'affiliation',
    'affiliate_network',
    'affiliate_code',
  ],
  search: ['search_term'],
  contact_click: ['contact_method'],
  sign_up: ['method'],
  login: ['method'],
  affiliate_landing_view: AFFILIATE_PARAMS,
  affiliate_signup_start: AFFILIATE_PARAMS,
  affiliate_link_created: AFFILIATE_PARAMS,
  affiliate_link_copied: AFFILIATE_PARAMS,
  affiliate_catalog_view: AFFILIATE_PARAMS,
  affiliate_order_created: AFFILIATE_PARAMS,
  affiliate_payment_link_sent: AFFILIATE_PARAMS,
  ...Object.fromEntries(LEAD_EVENT_NAMES.map((name) => [name, LEAD_PARAMS])),
};

export const GA4_ITEM_PARAM_ALLOWLIST = [
  'item_id',
  'item_name',
  'item_brand',
  'item_category',
  'item_variant',
  'price',
  'quantity',
  'index',
  'item_list_name',
] as const;

const SAFE_TOKEN = /^[\p{L}\p{M}\p{N}_\-./ ]{1,100}$/u;
const NUMERIC_PARAMS = new Set(['value', 'shipping', 'tax', 'price', 'quantity', 'index']);

function safeString(raw: unknown, max = 100): string | undefined {
  if (typeof raw !== 'string' && typeof raw !== 'number') return undefined;
  const value = String(raw).trim();
  if (!value || value.length > max || looksLikePii(value) || PII_PARAM_VALUE.test(value)) return undefined;
  return value;
}

function safeNumber(raw: unknown): number | undefined {
  const n = typeof raw === 'number' ? raw : Number.NaN;
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function safeItem(raw: unknown): Record<string, string | number> | null {
  if (!raw || typeof raw !== 'object') return null;
  const src = raw as Record<string, unknown>;
  const out: Record<string, string | number> = {};
  for (const key of GA4_ITEM_PARAM_ALLOWLIST) {
    if (!(key in src)) continue;
    const v = NUMERIC_PARAMS.has(key) ? safeNumber(src[key]) : safeString(src[key]);
    if (v !== undefined) out[key] = v;
  }
  return out.item_id || out.item_name ? out : null;
}

function safeParamValue(key: string, raw: unknown): unknown {
  const allowed = EVENT_PARAM_ENUMS[key];
  if (key === 'cart_age_bucket') return typeof raw === 'string' && allowed.has(raw) ? raw : undefined;
  if (allowed) {
    if (typeof raw !== 'string') return undefined;
    const value = raw.trim();
    return allowed.has(value.toLowerCase()) ? value : undefined;
  }
  if (key === 'items') {
    if (!Array.isArray(raw)) return undefined;
    return raw.slice(0, 200).map(safeItem).filter((it): it is Record<string, string | number> => Boolean(it));
  }
  if (NUMERIC_PARAMS.has(key)) return safeNumber(raw);
  if (key === 'cart_age_days') {
    return typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 && raw <= 3650 ? raw : undefined;
  }
  if (key === 'cart_fp') return typeof raw === 'string' && /^[a-z0-9]{1,16}$/.test(raw) ? raw : undefined;
  if (key === 'search_term') return safeString(raw, 80);
  const value = safeString(raw, 64);
  return value && SAFE_TOKEN.test(value) ? value : undefined;
}

/**
 * Allowlist layer: unknown event → null; unknown key or out-of-enum / PII-looking value → dropped.
 * Then the legacy key/value regex runs as a second layer on scalar params.
 */
export function enforceEventAllowlist(
  name: string,
  params: Record<string, unknown>,
): Record<string, unknown> | null {
  const allowed = EVENT_PARAM_ALLOWLIST[name];
  if (!allowed) return null;
  const out: Record<string, unknown> = {};
  for (const key of allowed) {
    if (!(key in params)) continue;
    const value = safeParamValue(key, params[key]);
    if (value === undefined) continue;
    if (key !== 'item_list_name' && PII_PARAM_KEY.test(key)) continue;
    if (typeof value === 'string' && PII_PARAM_VALUE.test(value)) continue;
    out[key] = value;
  }
  return out;
}

/** The only place that calls gtag('event'). */
function gtagEvent(name: string, params: Record<string, unknown>, sendTo?: string) {
  try {
    const safe = enforceEventAllowlist(name, params);
    if (!safe) return;
    if (sendTo) safe.send_to = sendTo;
    ensureGtagStub();
    if (typeof window.gtag === 'function') {
      window.gtag('event', name, safe);
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
    const gtagParams: Record<string, unknown> = { ...params, currency: GA4_CURRENCY };
    gtagEvent(name, gtagParams, resolveEcommerceGa4Id(channel));
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

/** Short non-reversible id for a cart fingerprint (FNV-1a 32-bit, base36). Empty cart → ''. */
export function cartFingerprintHash(
  items: Parameters<typeof checkoutCartFingerprint>[0],
): string {
  const fingerprint = checkoutCartFingerprint(items);
  if (!fingerprint) return '';
  let hash = 0x811c9dc5;
  for (let i = 0; i < fingerprint.length; i++) {
    hash ^= fingerprint.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

const CART_COHORT_KEY = 'taranom_ga4_cart_cohort';
const RETAIL_CART_STORAGE_KEY = 'taranom_retail_cart';
const DAY_MS = 86_400_000;

type CartCohort = { fp: string; since: number };
type CartSnapshotReader = () => RetailAnalyticsItemInput[] | null;

let cartSnapshotReader: CartSnapshotReader | null = null;

/** Cart owners register a synchronous reader so add_to_cart can fingerprint the post-add cart. */
export function registerCartSnapshot(reader: CartSnapshotReader | null) {
  cartSnapshotReader = reader;
}

function readCartSnapshot(): RetailAnalyticsItemInput[] | null {
  try {
    const fromOwner = cartSnapshotReader?.();
    if (fromOwner) return fromOwner;
    if (typeof window === 'undefined') return null;
    // zustand persist writes synchronously inside set(), before trackAddToCart runs.
    const raw = window.localStorage?.getItem(RETAIL_CART_STORAGE_KEY);
    const items = raw ? (JSON.parse(raw) as { state?: { items?: unknown } })?.state?.items : null;
    return Array.isArray(items) ? (items as RetailAnalyticsItemInput[]) : null;
  } catch {
    return null;
  }
}

/** Whole local calendar days between the first add and now (0 = same day). */
export function cartAgeDays(since: number, now = Date.now()): number {
  const start = new Date(since);
  const end = new Date(now);
  const a = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const b = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.max(0, Math.round((b - a) / DAY_MS));
}

function readCartCohort(): CartCohort | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage?.getItem(CART_COHORT_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<CartCohort>) : null;
    if (!parsed || typeof parsed.since !== 'number' || !Number.isFinite(parsed.since)) return null;
    return { fp: String(parsed.fp || ''), since: parsed.since };
  } catch {
    return null;
  }
}

function writeCartCohort(cohort: CartCohort) {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage?.setItem(CART_COHORT_KEY, JSON.stringify(cohort));
  } catch {
    /* private mode */
  }
}

export type CartAgeBucket = 'same_day' | '1_3_days' | '4_7_days' | '8_plus_days';

export function cartAgeBucket(days: number): CartAgeBucket {
  if (days <= 0) return 'same_day';
  if (days <= 3) return '1_3_days';
  if (days <= 7) return '4_7_days';
  return '8_plus_days';
}

function cohortParams(fp: string, cohort: CartCohort | null) {
  const out: { cart_fp?: string; cart_age_days?: number; cart_age_bucket?: CartAgeBucket } = {};
  if (fp) out.cart_fp = fp;
  if (cohort) {
    out.cart_age_days = cartAgeDays(cohort.since);
    out.cart_age_bucket = cartAgeBucket(out.cart_age_days);
  }
  return out;
}

/** add_to_cart: a cart that was empty before this add starts a new cohort. */
function noteCartAdd(input: RetailAnalyticsItemInput) {
  const snapshot = readCartSnapshot();
  const cart = snapshot?.length ? snapshot : [input];
  const addedQty = Math.max(1, Math.round(Number(input.quantity) || 1));
  const cartQty = cart.reduce((n, it) => n + Math.max(0, Number(it.quantity) || 0), 0);
  const prev = readCartCohort();
  const fp = cartFingerprintHash(cart);
  const cohort: CartCohort = {
    fp,
    since: prev && cartQty > addedQty ? prev.since : Date.now(),
  };
  writeCartCohort(cohort);
  return cohortParams(fp, cohort);
}

function noteCheckoutCart(fp: string) {
  const cohort = readCartCohort();
  if (cohort && fp && cohort.fp !== fp) writeCartCohort({ ...cohort, fp });
  return cohortParams(fp, cohort);
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
  if (raw.get('q') || raw.get('query') || raw.get('search')) {
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
    ...noteCartAdd(input),
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
  const fp = cartFingerprintHash(inputs);
  if (!claimBeginCheckout(fp)) return;
  const items = inputs
    .map((it, i) => toGa4Item(it, i))
    .filter((it): it is Ga4Item => Boolean(it));
  ecommerceEvent('begin_checkout', {
    currency: GA4_CURRENCY,
    value: ga4ValueFromStoredIrr(valueIrr),
    items,
    ...noteCheckoutCart(fp),
  });
}

export function trackAddShippingInfo(
  inputs: RetailAnalyticsItemInput[],
  valueIrr: number,
  shippingTier: string,
) {
  const tier = String(shippingTier || '').trim();
  if (!tier) return;
  const fp = cartFingerprintHash(inputs);
  if (!claimCheckoutStep('add_shipping_info', fp, tier)) return;
  const items = inputs
    .map((it, i) => toGa4Item(it, i))
    .filter((it): it is Ga4Item => Boolean(it));
  ecommerceEvent('add_shipping_info', {
    currency: GA4_CURRENCY,
    value: ga4ValueFromStoredIrr(valueIrr),
    shipping_tier: tier,
    items,
    ...noteCheckoutCart(fp),
  });
}

export function trackAddPaymentInfo(
  inputs: RetailAnalyticsItemInput[],
  valueIrr: number,
  paymentType: string,
) {
  const payment = String(paymentType || '').trim();
  if (!payment) return;
  const fp = cartFingerprintHash(inputs);
  if (!claimCheckoutStep('add_payment_info', fp, payment)) return;
  const items = inputs
    .map((it, i) => toGa4Item(it, i))
    .filter((it): it is Ga4Item => Boolean(it));
  ecommerceEvent('add_payment_info', {
    currency: GA4_CURRENCY,
    value: ga4ValueFromStoredIrr(valueIrr),
    payment_type: payment,
    items,
    ...noteCheckoutCart(fp),
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

const PII_PARAM_KEY = /phone|mobile|email|name|address|token|otp|national|card|iban|password|authority|payment_?id|tracking|ref_?id/i;
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
    if (!value || value.length > 80 || PII_PARAM_VALUE.test(value) || looksLikePii(value)) continue;
    out[key] = value;
  }
  return out;
}

function plainEvent(name: string, params: Record<string, unknown>) {
  if (!shouldSendRetailAnalytics()) return;
  gtagEvent(name, sanitizeEventParams(params), resolveRetailGa4Id());
}

export function trackSearch(term: string) {
  const search_term = String(term ?? '').trim().slice(0, 80);
  if (!search_term || PII_PARAM_VALUE.test(search_term) || looksLikePii(search_term)) return;
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

const WHOLESALE_LEAD_EVENTS: ReadonlySet<string> = new Set(LEAD_EVENT_NAMES);

/** Lead events carry only enum params (see EVENT_PARAM_ALLOWLIST); page context comes from gtag('set'). */
export function trackWholesaleLead(
  name: string,
  params: Record<string, unknown> = {},
) {
  if (!WHOLESALE_LEAD_EVENTS.has(name)) return;
  if (!shouldSendWholesaleAnalytics()) return;
  try {
    gtagEvent(name, { ...sanitizeEventParams(params), lead_type: name }, resolveWholesaleGa4Id());
  } catch {
    /* never throw into UI */
  }
}
