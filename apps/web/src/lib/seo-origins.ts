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

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'https://api.poshaktaranom.com/v1';

export function absoluteUrl(origin: string, path: string): string {
  if (!path || path === '/') return origin;
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}
