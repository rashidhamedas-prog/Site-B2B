/**
 * Google Analytics 4 + Search Console helpers (wholesale + retail).
 */

export type GoogleChannel = 'WHOLESALE' | 'RETAIL';

/** Accept only safe GA4 Measurement IDs (G-XXXXXXXX). */
export function sanitizeGa4Id(raw?: string | null): string {
  const v = String(raw ?? '').trim().toUpperCase();
  if (!/^G-[A-Z0-9]+$/.test(v)) return '';
  return v;
}

/** Optional GTM container (GTM-XXXX). */
export function sanitizeGtmId(raw?: string | null): string {
  const v = String(raw ?? '').trim().toUpperCase();
  if (!/^GTM-[A-Z0-9]+$/.test(v)) return '';
  return v;
}

/** Search Console HTML-tag verification token (content=...). */
export function sanitizeGscToken(raw?: string | null): string {
  const v = String(raw ?? '').trim();
  // Google tokens are typically base64-ish; keep conservative charset
  if (!v || v.length > 120 || !/^[A-Za-z0-9_-]+$/.test(v)) return '';
  return v;
}

export function ga4EnvFor(channel: GoogleChannel): string {
  return sanitizeGa4Id(
    channel === 'RETAIL'
      ? process.env.NEXT_PUBLIC_GA4_RETAIL_ID
      : process.env.NEXT_PUBLIC_GA4_WHOLESALE_ID,
  );
}

export function gtmEnvFor(channel: GoogleChannel): string {
  return sanitizeGtmId(
    channel === 'RETAIL'
      ? process.env.NEXT_PUBLIC_GTM_RETAIL_ID
      : process.env.NEXT_PUBLIC_GTM_WHOLESALE_ID,
  );
}

export function gscEnvFor(channel: GoogleChannel): string {
  return sanitizeGscToken(
    channel === 'RETAIL'
      ? process.env.NEXT_PUBLIC_GSC_RETAIL
      : process.env.NEXT_PUBLIC_GSC_WHOLESALE,
  );
}

/** Hosts that must never receive production GA4/GTM. */
export function isNonProductionAnalyticsHost(host: string | null | undefined): boolean {
  if (!host) return true;
  const h = host.split(':')[0]!.toLowerCase();
  if (h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h === '::1') return true;
  if (h.endsWith('.local') || h.endsWith('.localhost')) return true;
  if (h.endsWith('.vercel.app') || h.endsWith('.netlify.app')) return true;
  if (h.endsWith('.ngrok.io') || h.endsWith('.ngrok-free.app') || h.endsWith('.trycloudflare.com')) {
    return true;
  }
  if (h.startsWith('preview.') || h.includes('.preview.') || h.startsWith('staging.') || h.startsWith('dev.')) {
    return true;
  }
  return false;
}

/** No GTM/GA at all: admin, and `/confirm/*` whose path segment is a secret token. */
export function isAdminAnalyticsPath(pathname: string | null | undefined): boolean {
  const p = pathname || '';
  return p === '/admin' || p.startsWith('/admin/') || p.startsWith('/confirm/');
}

/**
 * Query keys kept on a GA4 page path (campaign attribution only). Everything else —
 * search terms, filters, gateway params (Authority, paymentId, trackingCode, token) — is dropped.
 */
export const ANALYTICS_QUERY_ALLOWLIST: ReadonlySet<string> = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'utm_id',
  'gclid',
  'gbraid',
  'wbraid',
]);

const NON_ASCII_DIGITS = /[\u06F0-\u06F9\u0660-\u0669]/g;

function asciiDigits(value: string): string {
  return value.replace(NON_ASCII_DIGITS, (d) => {
    const code = d.charCodeAt(0);
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return value;
  }
}

/**
 * Email or Iranian mobile in any common spelling: `%40`-encoded, Persian/Arabic digits,
 * separators (0912-345-6789, +98 912 345 6789, 0098…).
 */
export function looksLikePii(raw: unknown): boolean {
  if (raw == null) return false;
  const value = asciiDigits(safeDecode(String(raw)));
  if (/@|%40|\uFF20/i.test(value)) return true;
  const compact = value.replace(/[\s\-–.()_/]/g, '');
  if (/(?:^|\D)(?:\+98|0098|98|0)9\d{9}(?!\d)/.test(compact)) return true;
  if (/^9\d{9}$/.test(compact)) return true;
  return false;
}

/** Stricter check for URL query values: also drops bare 10-digit ids (national id). */
function looksLikeQueryPii(value: string): boolean {
  if (looksLikePii(value)) return true;
  return /^\d{10}$/.test(asciiDigits(safeDecode(value)).replace(/[\s-]/g, ''));
}

/** Strip the internal App Router `/retail` prefix so GA4 sees the public URL. */
export function stripRetailInternalPath(pathname: string | null | undefined): string {
  const raw = pathname || '/';
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  if (path === '/retail') return '/';
  if (path.startsWith('/retail/')) {
    const next = path.slice('/retail'.length);
    return next.length ? next : '/';
  }
  return path || '/';
}

export function sanitizeAnalyticsSearch(search: string | null | undefined): string {
  const raw = String(search ?? '')
    .replace(/^\?/, '')
    .split('#')[0] ?? '';
  if (!raw) return '';
  const params = new URLSearchParams(raw);
  const next = new URLSearchParams();
  for (const [key, value] of params.entries()) {
    const normalized = key.trim().toLowerCase();
    if (!ANALYTICS_QUERY_ALLOWLIST.has(normalized)) continue;
    const clean = value.trim();
    if (!clean || clean.length > 120 || looksLikeQueryPii(clean)) continue;
    next.append(normalized, clean);
  }
  return next.toString();
}

/**
 * Public page path for GA4. Prefer the browser URL (already rewritten);
 * fall back to stripping `/retail` from Next's internal pathname.
 */
export function publicAnalyticsPagePath(
  pathname: string | null | undefined,
  search?: string | null,
): string {
  const path = stripRetailInternalPath(pathname);
  const q = sanitizeAnalyticsSearch(search);
  return q ? `${path}?${q}` : path;
}

/** SSR marker rendered by GoogleAnalyticsProvider on routes where the app sends page_view itself. */
export const GA_PAGEVIEW_OWNER_ATTR = 'data-ga-pageview-owner';

/**
 * gtag `set` fields to queue before gtm.js loads. The container's Google tag otherwise
 * sends an automatic page_view from the raw URL (gateway tokens, double counting).
 * Returns null when the container's defaults are already safe for this page.
 */
export function preGtmGtagSet(input: {
  origin: string;
  pathname: string;
  search: string;
  appOwnsPageView: boolean;
  referrer?: string;
}): { page_location: string; page_referrer?: string; send_page_view?: false } | null {
  const path = publicAnalyticsPagePath(input.pathname, input.search);
  const page_location = `${input.origin}${path}`;
  const rawReferrer = String(input.referrer || '');
  const host = (() => {
    try {
      return new URL(input.origin).hostname;
    } catch {
      return '';
    }
  })();
  const page_referrer = rawReferrer ? sanitizeAnalyticsReferrer(rawReferrer, host) : '';
  const referrerFields = rawReferrer && page_referrer !== rawReferrer ? { page_referrer } : {};
  if (input.appOwnsPageView) return { page_location, ...referrerFields, send_page_view: false };
  const raw = `${stripRetailInternalPath(input.pathname)}${input.search && input.search !== '?' ? (input.search.startsWith('?') ? input.search : `?${input.search}`) : ''}`;
  return raw === path && !('page_referrer' in referrerFields) ? null : { page_location, ...referrerFields };
}

/** Confirmed retail stream (Windsor property 547378194). Fallback when env/admin empty. */
export const RETAIL_GA4_MEASUREMENT_ID = 'G-F2V7VSJMLE';

/** Confirmed wholesale stream (Windsor property 547352333). Fallback when env/admin empty. */
export const WHOLESALE_GA4_MEASUREMENT_ID = 'G-YVT5DXZF5Z';

/** Stream id known synchronously (env or confirmed fallback); admin overrides arrive later. */
export function defaultGa4IdFor(channel: string | null | undefined): string {
  if (channel === 'RETAIL') return ga4EnvFor('RETAIL') || RETAIL_GA4_MEASUREMENT_ID;
  if (channel === 'WHOLESALE') return ga4EnvFor('WHOLESALE') || WHOLESALE_GA4_MEASUREMENT_ID;
  return '';
}

export function pageViewDedupeKey(measurementId: string, publicPath: string): string {
  return `${measurementId}|${publicPath}`;
}

export function shouldSendPageView(previousKey: string, nextKey: string): boolean {
  if (!nextKey || nextKey.endsWith('|')) return false;
  return previousKey !== nextKey;
}

export const PAYMENT_REFERRER_HOSTS = [
  'web.mydigipay.com',
  'www.mydigipay.com',
  'api.mydigipay.com',
  'uatweb.mydigipay.info',
  'payment.zarinpal.com',
  'sandbox.zarinpal.com',
  'www.zarinpal.com',
  'zarinpal.com',
  'cpg.torobpay.com',
] as const;

/** True only for the return hosts of the live retail gateways. */
export function isApprovedPaymentReferrer(referrer: string | null | undefined): boolean {
  try {
    const host = new URL(String(referrer || '')).hostname.toLowerCase();
    return (PAYMENT_REFERRER_HOSTS as readonly string[]).includes(host);
  } catch {
    return false;
  }
}

/**
 * Referrer safe for GA4 `page_referrer`: gateway hosts → origin only (their paths carry
 * Authority/tokens); same site → sanitized public path; other sites → origin + path, no query.
 */
export function sanitizeAnalyticsReferrer(
  referrer: string | null | undefined,
  currentHost?: string | null,
): string {
  try {
    const u = new URL(String(referrer || ''));
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return '';
    if (isApprovedPaymentReferrer(u.href)) return `${u.origin}/`;
    const host = String(currentHost || '').split(':')[0]!.toLowerCase();
    if (host && u.hostname.toLowerCase() === host) {
      return `${u.origin}${publicAnalyticsPagePath(u.pathname, u.search)}`;
    }
    return `${u.origin}${u.pathname}`;
  } catch {
    return '';
  }
}

export function shouldLoadProductionTags(
  host: string | null | undefined,
  pathname?: string | null,
): boolean {
  if (isNonProductionAnalyticsHost(host)) return false;
  if (pathname && isAdminAnalyticsPath(pathname)) return false;
  return true;
}

/**
 * dataLayer-compatible gtag stub. Does NOT load gtag.js — GTM owns the GA4 tag.
 * Commands must be queued as an `arguments` object. A rest-parameter array is
 * not replayed as a gtag command, so page_view and ecommerce never reach GA4
 * while the container's own session_start and scroll still do.
 */
export function ensureGtagStub(): void {
  if (typeof window === 'undefined') return;
  const w = window as Window & {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  };
  w.dataLayer = w.dataLayer || [];
  if (typeof w.gtag === 'function') return;
  w.gtag = function gtag() {
    // GTM replays only the Arguments object, not a copied array.
    w.dataLayer!.push(arguments);
  };
}
