/** Public site origins — safe for Client Components (no next/headers). */

export const WHOLESALE_ORIGIN = 'https://poshaktaranom.com';
export const RETAIL_ORIGIN = 'https://www.poshaktaranom.ir';

/**
 * Retail → wholesale outbound link with fixed, lowercase UTMs so GA4 does not
 * lump it under (direct) / generic referral. `content` = placement (no PII).
 */
export function retailToWholesaleUrl(content: string, path = '/'): string {
  const url = new URL(absoluteUrl(WHOLESALE_ORIGIN, path));
  url.searchParams.set('utm_source', 'poshaktaranom.ir');
  url.searchParams.set('utm_medium', 'referral');
  url.searchParams.set('utm_campaign', 'retail_to_wholesale');
  const c = String(content || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40);
  if (c) url.searchParams.set('utm_content', c);
  return url.toString();
}

/** Add the retail→wholesale UTMs to an admin-entered link only when it targets the wholesale host and has none. */
export function withRetailToWholesaleUtm(href: string | undefined, content: string): string | undefined {
  if (!href) return href;
  try {
    const url = new URL(href);
    const host = url.hostname.toLowerCase();
    if (host !== 'poshaktaranom.com' && host !== 'www.poshaktaranom.com') return href;
    if (url.searchParams.has('utm_source')) return href;
    const tagged = new URL(retailToWholesaleUrl(content));
    tagged.searchParams.forEach((value, key) => url.searchParams.set(key, value));
    return url.toString();
  } catch {
    return href;
  }
}

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'https://api.poshaktaranom.com/v1';

export function absoluteUrl(origin: string, path: string): string {
  if (!path || path === '/') return origin;
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}
