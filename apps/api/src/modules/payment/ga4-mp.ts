/**
 * Pure helpers for GA4 Measurement Protocol purchase (no I/O).
 * Amounts are stored IRR and sent with currency IRR (no ×10 / ÷10).
 */

export type Ga4Channel = 'RETAIL' | 'WHOLESALE';

export const GA4_DEFAULT_MEASUREMENT_IDS: Record<Ga4Channel, string> = {
  RETAIL: 'G-F2V7VSJMLE',
  WHOLESALE: 'G-YVT5DXZF5Z',
};

export type Ga4MpConfig = {
  enabled: boolean;
  measurementId: string;
  apiSecret: string;
};

export type Ga4MpItem = {
  item_id: string;
  item_name: string;
  item_brand: string;
  item_variant?: string;
  price: number;
  quantity: number;
};

export type Ga4MpPurchaseEvent = {
  name: 'purchase';
  params: {
    transaction_id: string;
    currency: 'IRR';
    value: number;
    shipping?: number;
    affiliation?: string;
    session_id?: string;
    engagement_time_msec: number;
    items: Ga4MpItem[];
  };
};

export type Ga4MpBody = {
  client_id: string;
  non_personalized_ads?: boolean;
  events: Ga4MpPurchaseEvent[];
};

const GA_ID = /^G-[A-Z0-9]+$/;
const CLIENT_ID = /^\d{5,12}\.\d{5,12}$/;
const SESSION_ID = /^\d{6,14}$/;
const PII = /@|09\d{9}|\+98\d{10}/;

export function sanitizeMeasurementId(raw?: string | null): string {
  const v = String(raw ?? '').trim().toUpperCase();
  return GA_ID.test(v) ? v : '';
}

/** Accept only the GA client id form `123456789.1234567890`. */
export function sanitizeGaClientId(raw?: string | null): string {
  const v = String(raw ?? '').trim();
  return CLIENT_ID.test(v) ? v : '';
}

export function sanitizeGaSessionId(raw?: string | null): string {
  const v = String(raw ?? '').trim();
  return SESSION_ID.test(v) ? v : '';
}

/**
 * Server env for one channel. Secret is never NEXT_PUBLIC_.
 * GA4_SERVER_PURCHASE_ENABLED=true is the feature flag (default off).
 */
export function resolveGa4MpConfig(
  channel: Ga4Channel,
  env: Record<string, string | undefined> = process.env,
): Ga4MpConfig {
  const flag = String(env.GA4_SERVER_PURCHASE_ENABLED ?? '').trim().toLowerCase();
  const prefix = channel === 'RETAIL' ? 'GA4_MP_RETAIL' : 'GA4_MP_WHOLESALE';
  const measurementId =
    sanitizeMeasurementId(env[`${prefix}_MEASUREMENT_ID`]) || GA4_DEFAULT_MEASUREMENT_IDS[channel];
  const apiSecret = String(env[`${prefix}_API_SECRET`] ?? '').trim();
  const enabled = (flag === 'true' || flag === '1') && apiSecret.length >= 8 && !!measurementId;
  return { enabled, measurementId, apiSecret };
}

function safeText(raw: unknown, max = 100): string {
  const v = String(raw ?? '').trim();
  if (!v || PII.test(v)) return '';
  return v.slice(0, max);
}

export function buildPurchaseBody(input: {
  clientId: string;
  sessionId?: string;
  transactionId: string;
  valueIrr: number;
  shippingIrr?: number;
  affiliation?: string;
  items: Array<{
    sku?: string | null;
    productName?: string | null;
    color?: string | null;
    size?: string | null;
    unitPrice?: number | string | null;
    quantity?: number | null;
  }>;
}): Ga4MpBody | null {
  const transaction_id = safeText(input.transactionId, 64);
  const client_id = sanitizeGaClientId(input.clientId);
  if (!transaction_id || !client_id) return null;
  const value = Math.max(0, Math.round(Number(input.valueIrr) || 0));
  if (value <= 0) return null;
  const items: Ga4MpItem[] = [];
  for (const it of input.items ?? []) {
    const id = safeText(it.sku, 64) || safeText(it.productName, 64);
    const name = safeText(it.productName, 100) || id;
    if (!id) continue;
    const variant = [safeText(it.color, 40), safeText(it.size, 20)].filter(Boolean).join(' / ');
    const item: Ga4MpItem = {
      item_id: id,
      item_name: name,
      item_brand: 'Taranom',
      price: Math.max(0, Math.round(Number(it.unitPrice) || 0)),
      quantity: Math.max(1, Math.round(Number(it.quantity) || 1)),
    };
    if (variant) item.item_variant = variant;
    items.push(item);
  }
  const params: Ga4MpPurchaseEvent['params'] = {
    transaction_id,
    currency: 'IRR',
    value,
    engagement_time_msec: 1,
    items,
  };
  const shipping = Math.max(0, Math.round(Number(input.shippingIrr) || 0));
  if (shipping > 0) params.shipping = shipping;
  const affiliation = safeText(input.affiliation, 32);
  if (affiliation) params.affiliation = affiliation;
  const session = sanitizeGaSessionId(input.sessionId);
  if (session) params.session_id = session;
  return { client_id, events: [{ name: 'purchase', params }] };
}

export function mpCollectUrl(cfg: Pick<Ga4MpConfig, 'measurementId' | 'apiSecret'>): string {
  const q = new URLSearchParams({ measurement_id: cfg.measurementId, api_secret: cfg.apiSecret });
  return `https://www.google-analytics.com/mp/collect?${q.toString()}`;
}
