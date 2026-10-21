/**
 * GA4 Measurement Protocol (MP) purchase helpers.
 * Amounts are stored IRR and sent with currency IRR (no ×10 / ÷10).
 *
 * MP answers 2xx even for malformed payloads, so a 2xx is transport acceptance
 * only — it never proves the event is valid or will appear in reports. Payload
 * validity is enforced locally by `validatePurchaseBody` before any POST, and
 * checked against Google's validation server by `scripts/ga4-mp-validate.ts`.
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
  /** Original purchase time (unix µs); MP accepts up to 72h backdating. */
  timestamp_micros: number;
  non_personalized_ads?: boolean;
  events: Ga4MpPurchaseEvent[];
};

const GA_ID = /^G-[A-Z0-9]+$/;
const CLIENT_ID = /^\d{5,12}\.\d{5,12}$/;
const SESSION_ID = /^\d{6,14}$/;
const PII = /@|09\d{9}|\+98\d{10}/;
const DIGIT_RUN = /\+?\d[\d\s\-().]{7,}\d/g;
const PHONE = /^(?:\+98|0098|98|0)9\d{9}$/;
const CARD = /^\d{16,}$/;
const ORDER_NUMBER = /^ORD-\d{4}-\d{5,9}-[0-9A-F]{6}$/;
const PAYMENT_TOKEN = /\bA0{6,}\w*|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const HOUR_MS = 3_600_000;
export const MP_MAX_BACKDATE_MS = 72 * HOUR_MS;
const MP_FUTURE_SKEW_MS = 60_000;
const MAX_PARAMS = 25;
const MAX_STRING = 100;

const BODY_KEYS = new Set(['client_id', 'timestamp_micros', 'non_personalized_ads', 'events']);
const EVENT_KEYS = new Set(['name', 'params']);
const PARAM_KEYS = new Set([
  'transaction_id',
  'currency',
  'value',
  'shipping',
  'affiliation',
  'session_id',
  'engagement_time_msec',
  'items',
]);
const ITEM_KEYS = new Set(['item_id', 'item_name', 'item_brand', 'item_variant', 'price', 'quantity']);

/** Email, Iranian mobile (incl. Persian/Arabic digits and separators), PSP Authority, UUIDs, card-like numbers. */
export function looksSensitive(raw: unknown): boolean {
  const v = String(raw ?? '');
  if (PII.test(v) || v.includes('@')) return true;
  const ascii = v
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  if (PAYMENT_TOKEN.test(ascii)) return true;
  for (const run of ascii.match(DIGIT_RUN) ?? []) {
    const digits = run.replace(/[\s\-().]/g, '');
    if (PHONE.test(digits) || CARD.test(digits)) return true;
  }
  return false;
}

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

function safeText(raw: unknown, max = MAX_STRING): string {
  const v = String(raw ?? '').trim();
  if (!v || looksSensitive(v)) return '';
  return v.slice(0, max);
}

/** Our own order numbers can form a 16+ digit run (count ≥ 100000 + all-digit hex suffix). */
function safeTransactionId(raw: unknown): string {
  const v = String(raw ?? '').trim();
  return ORDER_NUMBER.test(v) ? v : safeText(v, 64);
}

export type Ga4ValidationResult = { ok: true; errors?: undefined } | { ok: false; errors: string[] };

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v);

function checkText(errors: string[], path: string, v: unknown, required: boolean): void {
  if (v === undefined && !required) return;
  if (typeof v !== 'string' || !v.trim() || v.length > MAX_STRING || looksSensitive(v)) errors.push(path);
}

/**
 * Strict allowlist schema for the purchase body we send. Errors are field paths
 * only (never values), so they are safe to store in `lastError` and logs.
 */
export function validatePurchaseBody(
  body: unknown,
  opts: { transactionId?: string; nowMs?: number } = {},
): Ga4ValidationResult {
  const errors: string[] = [];
  const nowMs = opts.nowMs ?? Date.now();
  if (!isObj(body)) return { ok: false, errors: ['body'] };
  for (const k of Object.keys(body)) if (!BODY_KEYS.has(k)) errors.push('body.<unknown>');
  if (typeof body.client_id !== 'string' || !sanitizeGaClientId(body.client_id)) errors.push('client_id');

  const ts = body.timestamp_micros;
  if (!isInt(ts)) errors.push('timestamp_micros');
  else if (ts > (nowMs + MP_FUTURE_SKEW_MS) * 1000 || ts < (nowMs - MP_MAX_BACKDATE_MS) * 1000) {
    errors.push('timestamp_micros');
  }
  if (body.non_personalized_ads !== undefined && typeof body.non_personalized_ads !== 'boolean') {
    errors.push('non_personalized_ads');
  }

  const events = body.events;
  if (!Array.isArray(events) || events.length !== 1 || !isObj(events[0])) {
    errors.push('events');
    return { ok: false, errors };
  }
  const ev = events[0];
  for (const k of Object.keys(ev)) if (!EVENT_KEYS.has(k)) errors.push('events[0].<unknown>');
  if (ev.name !== 'purchase') errors.push('events[0].name');
  const p = ev.params;
  if (!isObj(p)) {
    errors.push('params');
    return { ok: false, errors };
  }
  const keys = Object.keys(p);
  if (keys.length > MAX_PARAMS) errors.push('params.<count>');
  for (const k of keys) if (!PARAM_KEYS.has(k)) errors.push('params.<unknown>');

  if (!(typeof p.transaction_id === 'string' && ORDER_NUMBER.test(p.transaction_id))) {
    checkText(errors, 'params.transaction_id', p.transaction_id, true);
  }
  if (opts.transactionId !== undefined && p.transaction_id !== String(opts.transactionId).trim()) {
    if (!errors.includes('params.transaction_id')) errors.push('params.transaction_id');
  }
  if (p.currency !== 'IRR') errors.push('params.currency');
  if (!isInt(p.value) || p.value < 0) errors.push('params.value');
  if (p.shipping !== undefined && (!isInt(p.shipping) || p.shipping < 0)) errors.push('params.shipping');
  checkText(errors, 'params.affiliation', p.affiliation, false);
  if (p.session_id !== undefined && (typeof p.session_id !== 'string' || !sanitizeGaSessionId(p.session_id))) {
    errors.push('params.session_id');
  }
  if (!isInt(p.engagement_time_msec) || p.engagement_time_msec <= 0) errors.push('params.engagement_time_msec');

  if (!Array.isArray(p.items) || p.items.length === 0) {
    errors.push('params.items');
  } else {
    p.items.forEach((it: unknown, i: number) => {
      const at = `items[${i}]`;
      if (!isObj(it)) {
        errors.push(at);
        return;
      }
      for (const k of Object.keys(it)) if (!ITEM_KEYS.has(k)) errors.push(`${at}.<unknown>`);
      checkText(errors, `${at}.item_id`, it.item_id, true);
      checkText(errors, `${at}.item_name`, it.item_name, true);
      checkText(errors, `${at}.item_brand`, it.item_brand, false);
      checkText(errors, `${at}.item_variant`, it.item_variant, false);
      if (!isInt(it.price) || it.price < 0) errors.push(`${at}.price`);
      if (!isInt(it.quantity) || it.quantity < 1) errors.push(`${at}.quantity`);
    });
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}

export type Ga4PurchaseInput = {
  clientId: string;
  sessionId?: string;
  transactionId: string;
  valueIrr: number;
  shippingIrr?: number;
  affiliation?: string;
  /** Original purchase time (ms). Never the send time — retries must keep it. */
  eventTimeMs: number;
  /** Clock for validation; defaults to Date.now(). */
  nowMs?: number;
  items: Array<{
    sku?: string | null;
    productName?: string | null;
    color?: string | null;
    size?: string | null;
    unitPrice?: number | string | null;
    quantity?: number | null;
  }>;
};

export type Ga4BuildResult = { body: Ga4MpBody; errors?: undefined } | { body: null; errors: string[] };

/** Builds the production purchase body and validates it; `errors` holds field paths when invalid. */
export function buildPurchaseBodyChecked(input: Ga4PurchaseInput): Ga4BuildResult {
  const client_id = sanitizeGaClientId(input.clientId);
  if (!client_id) return { body: null, errors: ['client_id'] };
  const value = Math.max(0, Math.round(Number(input.valueIrr) || 0));
  if (value <= 0) return { body: null, errors: ['params.value'] };
  const items: Ga4MpItem[] = [];
  for (const it of input.items ?? []) {
    const id = safeText(it.sku, 64) || safeText(it.productName, 64);
    const name = safeText(it.productName, MAX_STRING) || id;
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
    transaction_id: safeTransactionId(input.transactionId),
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
  const body: Ga4MpBody = {
    client_id,
    timestamp_micros: Math.round(Number(input.eventTimeMs)) * 1000,
    events: [{ name: 'purchase', params }],
  };
  const check = validatePurchaseBody(body, { transactionId: input.transactionId, nowMs: input.nowMs });
  return check.ok ? { body } : { body: null, errors: check.errors };
}

/** Production body or null when it would fail `validatePurchaseBody`. */
export function buildPurchaseBody(input: Ga4PurchaseInput): Ga4MpBody | null {
  return buildPurchaseBodyChecked(input).body;
}

const MP_HOST = 'https://www.google-analytics.com';

/** Production collection endpoint. The only URL `postPurchase` ever calls. */
export function mpCollectUrl(cfg: Pick<Ga4MpConfig, 'measurementId' | 'apiSecret'>): string {
  const q = new URLSearchParams({ measurement_id: cfg.measurementId, api_secret: cfg.apiSecret });
  return `${MP_HOST}/mp/collect?${q.toString()}`;
}

/** Validation server (events never reach reports). Used by scripts/ga4-mp-validate.ts only. */
export function mpDebugUrl(cfg: Pick<Ga4MpConfig, 'measurementId' | 'apiSecret'>): string {
  const q = new URLSearchParams({ measurement_id: cfg.measurementId, api_secret: cfg.apiSecret });
  return `${MP_HOST}/debug/mp/collect?${q.toString()}`;
}

/**
 * Backoff after attempt n (1-based): attempt n+1 is due SCHEDULE[n-1] later.
 * 1 inline + 8 retries; cumulative 46h21m, inside MP's 72h backdating window.
 */
export const GA4_RETRY_SCHEDULE_MS: readonly number[] = [
  60_000,
  5 * 60_000,
  15 * 60_000,
  HOUR_MS,
  3 * HOUR_MS,
  6 * HOUR_MS,
  12 * HOUR_MS,
  24 * HOUR_MS,
];
export const GA4_MAX_ATTEMPTS = GA4_RETRY_SCHEDULE_MS.length + 1;
/** Attempts are abandoned (EXPIRED) once the purchase is this old; 1h margin under the 72h MP limit. */
export const GA4_EXPIRE_AFTER_HOURS = 71;

/** Delay before the next attempt after `attempts` completed attempts, or null when exhausted. */
export function nextAttemptDelayMs(attempts: number): number | null {
  if (!Number.isInteger(attempts) || attempts < 1 || attempts >= GA4_MAX_ATTEMPTS) return null;
  return GA4_RETRY_SCHEDULE_MS[attempts - 1];
}

/** Only transient HTTP failures are retried; other 4xx mean the request itself is wrong. */
export function isRetryableStatus(code: number): boolean {
  return code === 429 || (code >= 500 && code <= 599);
}

export type Ga4SendOutcome =
  /** 2xx: Google accepted the request. Not proof of payload validity. */
  | { kind: 'transport_accepted' }
  | { kind: 'invalid'; code: string }
  | { kind: 'retryable'; code: string }
  | { kind: 'rejected'; code: string };

export type Ga4FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal },
) => Promise<{ status: number; body?: { cancel(): Promise<void> } | null }>;

/** Short, log-safe code for a fetch failure (never the error message). */
export function fetchErrorCode(err: unknown): 'timeout' | 'network' {
  const name = err instanceof Error ? err.name : '';
  return name === 'AbortError' || name === 'TimeoutError' ? 'timeout' : 'network';
}

/**
 * Validates, then POSTs once to the production endpoint. An invalid body is
 * never sent, whatever the transport would have answered.
 */
export async function postPurchase(
  cfg: Pick<Ga4MpConfig, 'measurementId' | 'apiSecret'>,
  body: Ga4MpBody,
  opts: { transactionId: string; timeoutMs: number; fetchImpl?: Ga4FetchLike; nowMs?: number },
): Promise<Ga4SendOutcome> {
  const check = validatePurchaseBody(body, { transactionId: opts.transactionId, nowMs: opts.nowMs });
  if (!check.ok) return { kind: 'invalid', code: `schema_invalid:${check.errors[0]}` };
  const url = mpCollectUrl(cfg);
  if (url.includes('/debug/')) return { kind: 'invalid', code: 'debug_endpoint' };
  const doFetch = opts.fetchImpl ?? (fetch as unknown as Ga4FetchLike);
  try {
    const res = await doFetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(opts.timeoutMs),
    });
    await res.body?.cancel().catch(() => undefined);
    if (res.status >= 200 && res.status < 300) return { kind: 'transport_accepted' };
    const code = `http_${res.status}`;
    return isRetryableStatus(res.status) ? { kind: 'retryable', code } : { kind: 'rejected', code };
  } catch (err: unknown) {
    return { kind: 'retryable', code: fetchErrorCode(err) };
  }
}
