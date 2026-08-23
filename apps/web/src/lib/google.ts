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
  return false;
}

export function isAdminAnalyticsPath(pathname: string | null | undefined): boolean {
  const p = pathname || '';
  return p === '/admin' || p.startsWith('/admin/');
}

const SENSITIVE_QUERY =
  /^(phone|mobile|email|otp|token|password|recipient|address|street|postal|nationalid|national_id|access_token)$/i;

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
  const raw = String(search ?? '').replace(/^\?/, '');
  if (!raw) return '';
  const params = new URLSearchParams(raw);
  for (const key of [...params.keys()]) {
    if (SENSITIVE_QUERY.test(key)) params.delete(key);
  }
  return params.toString();
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
 * Queued commands are processed when the GTM Google Tag boots.
 */
export function ensureGtagStub(): void {
  if (typeof window === 'undefined') return;
  const w = window as Window & {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  };
  w.dataLayer = w.dataLayer || [];
  if (typeof w.gtag === 'function') return;
  w.gtag = function gtag(...args: unknown[]) {
    w.dataLayer!.push(args);
  };
}
