/**
 * Sales channel helpers for dual-storefront (B2B .com / B2C .ir)
 */
export type SalesChannel = 'WHOLESALE' | 'RETAIL';

export const RETAIL_HOSTS = new Set([
  'poshaktaranom.ir',
  'www.poshaktaranom.ir',
  'localhost.ir', // local hosts-file testing
]);

export function hostLooksRetail(host: string | null | undefined): boolean {
  if (!host) return false;
  const h = host.split(':')[0]!.toLowerCase();
  if (RETAIL_HOSTS.has(h)) return true;
  if (h.endsWith('.poshaktaranom.ir')) return true;
  return false;
}

export function isRetailPath(pathname: string): boolean {
  return pathname === '/retail' || pathname.startsWith('/retail/');
}

/** Paths that must never be rewritten to the retail tree */
export function isChannelExemptPath(pathname: string): boolean {
  return (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/portal') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/media') ||
    pathname.startsWith('/fonts') ||
    pathname.startsWith('/retail') ||
    pathname === '/favicon.svg' ||
    pathname === '/favicon.ico' ||
    pathname === '/manifest.json' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    pathname.startsWith('/payment')
  );
}
