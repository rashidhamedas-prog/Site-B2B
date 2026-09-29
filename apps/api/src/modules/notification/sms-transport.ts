/**
 * SMS.ir HTTP transport with optional Cloudflare (or other) egress rewrite.
 *
 * Hetzner/EU origins often cannot complete TLS to api.sms.ir; production
 * sets SMS_EGRESS_BASE_URL to a Worker that proxies to api.sms.ir.
 */

export const SMSIR_DIRECT_BASE = 'https://api.sms.ir/v1';

export const SMS_FETCH_TIMEOUT_MS = 12_000;

export type SmsTransportErrorCode =
  | 'DISABLED'
  | 'TIMEOUT'
  | 'NETWORK'
  | 'HTTP'
  | 'PROVIDER'
  | 'PARSE';

export interface SmsTransportConfig {
  /** Override base (e.g. https://sms-egress.example.com/v1). Empty → direct sms.ir */
  egressBaseUrl?: string | null;
  /** Shared secret sent as x-taranom-egress-secret when egress is used */
  egressSecret?: string | null;
  timeoutMs?: number;
}

export interface SmsTransportResult {
  ok: boolean;
  statusCode?: number;
  /** sms.ir JSON body when parsed */
  body?: unknown;
  errorCode?: SmsTransportErrorCode;
  errorMessage?: string;
  /** Resolved URL host for diagnostics (no secrets) */
  via: 'direct' | 'egress';
  durationMs: number;
}

const ALLOWED_PATHS = new Set([
  '/send/bulk',
  '/send/verify',
  '/credit',
  '/line',
]);

export function normalizeEgressBaseUrl(raw?: string | null): string {
  const s = String(raw || '').trim().replace(/\/+$/, '');
  if (!s) return '';
  // Accept either https://host or https://host/v1
  if (/\/v1$/i.test(s)) return s;
  return `${s}/v1`;
}

export function resolveSmsIrUrl(path: string, cfg?: SmsTransportConfig): { url: string; via: 'direct' | 'egress' } {
  const p = path.startsWith('/') ? path : `/${path}`;
  if (!ALLOWED_PATHS.has(p) && !p.startsWith('/send/') && !p.startsWith('/credit') && !p.startsWith('/line')) {
    // Still allow known prefixes used by sms.ir; reject path traversal
    if (p.includes('..') || p.includes('://')) {
      throw new Error('SMS_PATH_INVALID');
    }
  }
  const egress = normalizeEgressBaseUrl(cfg?.egressBaseUrl);
  if (egress) {
    return { url: `${egress}${p}`, via: 'egress' };
  }
  return { url: `${SMSIR_DIRECT_BASE}${p}`, via: 'direct' };
}

function classifyFetchError(err: unknown): { code: SmsTransportErrorCode; message: string } {
  const msg = err instanceof Error ? err.message : String(err || 'unknown');
  const name = err instanceof Error ? err.name : '';
  const cause = err instanceof Error && err.cause instanceof Error ? err.cause.message : '';
  const blob = `${name} ${msg} ${cause}`.toLowerCase();
  if (
    name === 'TimeoutError' ||
    blob.includes('aborted due to timeout') ||
    blob.includes('timeout') ||
    blob.includes('timed out')
  ) {
    return { code: 'TIMEOUT', message: msg };
  }
  if (blob.includes('fetch failed') || blob.includes('econnreset') || blob.includes('enotfound') || blob.includes('network')) {
    return { code: 'NETWORK', message: msg };
  }
  return { code: 'NETWORK', message: msg };
}

export async function smsIrRequest(
  method: 'GET' | 'POST',
  path: string,
  apiKey: string,
  body: Record<string, unknown> | undefined,
  cfg: SmsTransportConfig = {},
  fetchImpl: typeof fetch = fetch,
): Promise<SmsTransportResult> {
  const started = Date.now();
  let via: 'direct' | 'egress' = 'direct';
  let url = '';
  try {
    ({ url, via } = resolveSmsIrUrl(path, cfg));
  } catch (err: any) {
    return {
      ok: false,
      errorCode: 'PROVIDER',
      errorMessage: err?.message || 'SMS_PATH_INVALID',
      via: 'direct',
      durationMs: Date.now() - started,
    };
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'x-api-key': apiKey,
  };
  if (method === 'POST') {
    headers['Content-Type'] = 'application/json';
  }
  const secret = String(cfg.egressSecret || '').trim();
  if (via === 'egress' && secret) {
    headers['x-taranom-egress-secret'] = secret;
  }

  const timeoutMs = Math.max(3_000, Number(cfg.timeoutMs) || SMS_FETCH_TIMEOUT_MS);

  try {
    const res = await fetchImpl(url, {
      method,
      headers,
      body: method === 'POST' && body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const durationMs = Date.now() - started;
    let json: any;
    try {
      json = await res.json();
    } catch {
      return {
        ok: false,
        statusCode: res.status,
        errorCode: 'PARSE',
        errorMessage: `non-json response HTTP ${res.status}`,
        via,
        durationMs,
      };
    }
    // sms.ir: { status: 1, message: "موفق", data: {...} }
    const ok = json?.status === 1;
    if (!ok) {
      return {
        ok: false,
        statusCode: res.status,
        body: json,
        errorCode: res.ok ? 'PROVIDER' : 'HTTP',
        errorMessage: String(json?.message || `HTTP ${res.status}`).slice(0, 200),
        via,
        durationMs,
      };
    }
    return { ok: true, statusCode: res.status, body: json, via, durationMs };
  } catch (err) {
    const { code, message } = classifyFetchError(err);
    return {
      ok: false,
      errorCode: code,
      errorMessage: message.slice(0, 200),
      via,
      durationMs: Date.now() - started,
    };
  }
}
