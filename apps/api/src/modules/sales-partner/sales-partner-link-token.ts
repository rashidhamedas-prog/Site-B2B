import { createHmac, createHash, timingSafeEqual } from 'crypto';

const TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_PRODUCTS = 12;

export type SalesPartnerAttributionPayload = {
  v: 1;
  c: string;
  p: string[];
  e: number;
};

function b64url(buf: Buffer | string): string {
  const raw = Buffer.isBuffer(buf) ? buf : Buffer.from(buf, 'utf8');
  return raw.toString('base64url');
}

function fromB64url(raw: string): Buffer {
  return Buffer.from(raw, 'base64url');
}

export function hashClickFingerprint(value: string, secret: string): string {
  return createHmac('sha256', secret).update(`sp-click:${value}`).digest('hex').slice(0, 64);
}

export function hashClientIp(ip: string, secret: string): string {
  const normalized = String(ip || '').trim().toLowerCase() || 'unknown';
  return hashClickFingerprint(normalized, secret);
}

export function hashUserAgent(ua: string, secret: string): string {
  const normalized = String(ua || '').trim().slice(0, 400) || 'unknown';
  return createHash('sha256').update(`sp-ua:${normalized}:${secret}`).digest('hex').slice(0, 64);
}

function signBody(body: string, secret: string): string {
  return createHmac('sha256', secret).update(`sp-attr-v1:${body}`).digest('base64url');
}

/** Last-click wins: token covers the partner code and the clicked product id set. */
export function signSalesPartnerAttributionToken(input: {
  code: string;
  productIds: string[];
  secret: string;
  now?: Date;
  ttlMs?: number;
}): string {
  const code = String(input.code || '').trim().toLowerCase();
  if (!/^[a-z0-9]{8}$/.test(code)) throw new Error('INVALID_CODE');
  const seen = new Set<string>();
  const productIds: string[] = [];
  for (const id of input.productIds) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) continue;
    const key = id.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    productIds.push(key);
    if (productIds.length >= MAX_PRODUCTS) break;
  }
  if (!productIds.length) throw new Error('NO_PRODUCTS');
  const now = input.now ?? new Date();
  const payload: SalesPartnerAttributionPayload = {
    v: 1,
    c: code,
    p: productIds,
    e: now.getTime() + (input.ttlMs ?? TOKEN_TTL_MS),
  };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${signBody(body, input.secret)}`;
}

function parseSignedPayload(
  token: string | null | undefined,
  secret: string,
  now: Date,
): { ok: true; payload: SalesPartnerAttributionPayload } | { ok: false; reason: 'missing' | 'invalid' | 'expired' } {
  const raw = String(token || '').trim();
  if (!raw) return { ok: false, reason: 'missing' };
  const [body, sig] = raw.split('.');
  if (!body || !sig) return { ok: false, reason: 'invalid' };
  const expected = signBody(body, secret);
  try {
    const a = fromB64url(sig);
    const b = fromB64url(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: 'invalid' };
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  let payload: SalesPartnerAttributionPayload;
  try {
    payload = JSON.parse(fromB64url(body).toString('utf8')) as SalesPartnerAttributionPayload;
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (payload?.v !== 1 || typeof payload.c !== 'string' || !Array.isArray(payload.p) || typeof payload.e !== 'number') {
    return { ok: false, reason: 'invalid' };
  }
  if (payload.e < now.getTime()) return { ok: false, reason: 'expired' };
  return { ok: true, payload };
}

/** Read product ids from a prior cookie token for the same partner code. */
export function readPriorAttributionProductIds(input: {
  token: string | null | undefined;
  code: string;
  secret: string;
  now?: Date;
}): string[] {
  const parsed = parseSignedPayload(input.token, input.secret, input.now ?? new Date());
  if (!parsed.ok) return [];
  const code = String(input.code || '').trim().toLowerCase();
  if (parsed.payload.c !== code) return [];
  return parsed.payload.p
    .map((id) => String(id).toLowerCase())
    .filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))
    .slice(0, MAX_PRODUCTS);
}

export function verifySalesPartnerAttributionToken(input: {
  token: string | null | undefined;
  code: string;
  productIds: string[];
  secret: string;
  now?: Date;
}): { ok: true; productIds: string[] } | { ok: false; reason: 'missing' | 'invalid' | 'expired' | 'mismatch' } {
  const parsed = parseSignedPayload(input.token, input.secret, input.now ?? new Date());
  if (!parsed.ok) return parsed;
  const code = String(input.code || '').trim().toLowerCase();
  if (parsed.payload.c !== code) return { ok: false, reason: 'mismatch' };
  const allowed = new Set(parsed.payload.p.map((id) => String(id).toLowerCase()));
  const requested = input.productIds
    .map((id) => String(id).toLowerCase())
    .filter((id) => allowed.has(id));
  if (!requested.length) return { ok: false, reason: 'mismatch' };
  return { ok: true, productIds: [...new Set(requested)].slice(0, MAX_PRODUCTS) };
}

export function mergePriorProductIds(prior: string[] | undefined, nextProductId: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of [...(prior || []), nextProductId]) {
    const key = String(id || '').toLowerCase();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
    if (out.length >= MAX_PRODUCTS) break;
  }
  return out;
}
