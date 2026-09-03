import { hostLooksRetail } from './channel';

export const RETAIL_CANONICAL_ORIGIN = 'https://www.poshaktaranom.ir';
export const WHOLESALE_CANONICAL_ORIGIN = 'https://poshaktaranom.com';

export function hostLooksWholesale(host: string | null | undefined): boolean {
  if (!host) return false;
  const h = host.split(':')[0]!.toLowerCase();
  if (h === 'poshaktaranom.com' || h === 'www.poshaktaranom.com') return true;
  return h.endsWith('.poshaktaranom.com');
}

export function isLocalDevHost(host: string | null | undefined): boolean {
  if (!host) return true;
  const h = host.split(':')[0]!.toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h.includes('localhost');
}

export function isPortalPath(pathname: string): boolean {
  return pathname === '/portal' || pathname.startsWith('/portal/');
}

export function isRetailAccountPath(pathname: string): boolean {
  return (
    pathname === '/account' ||
    pathname.startsWith('/account/') ||
    pathname === '/retail/account' ||
    pathname.startsWith('/retail/account/')
  );
}

export function publicAccountPath(pathname: string): string {
  if (pathname === '/retail/account' || pathname.startsWith('/retail/account/')) {
    return pathname.slice('/retail'.length) || '/account';
  }
  return pathname;
}

/** Production-only: keep /portal on .com and /account on .ir. Localhost is unchanged. */
export function panelHostLockRedirect(args: {
  host: string | null | undefined;
  pathname: string;
  search?: string;
}): { origin: string; pathname: string; search: string } | null {
  if (isLocalDevHost(args.host)) return null;
  const search = args.search || '';
  if (hostLooksRetail(args.host) && isPortalPath(args.pathname)) {
    return { origin: WHOLESALE_CANONICAL_ORIGIN, pathname: args.pathname, search };
  }
  if (hostLooksWholesale(args.host) && isRetailAccountPath(args.pathname)) {
    return {
      origin: RETAIL_CANONICAL_ORIGIN,
      pathname: publicAccountPath(args.pathname),
      search,
    };
  }
  return null;
}
