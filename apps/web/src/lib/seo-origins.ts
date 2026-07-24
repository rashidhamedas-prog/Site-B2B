/** Public site origins — safe for Client Components (no next/headers). */

export const WHOLESALE_ORIGIN = 'https://poshaktaranom.com';
export const RETAIL_ORIGIN = 'https://www.poshaktaranom.ir';

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'https://api.poshaktaranom.com/v1';

export function absoluteUrl(origin: string, path: string): string {
  if (!path || path === '/') return origin;
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}
