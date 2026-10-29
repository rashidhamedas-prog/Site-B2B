import { hostLooksRetail, isSalesPartnerPanelPath } from './channel';
import { safeAccountRedirect, safeScopedRedirect } from './safe-redirect';

function appendSearch(pathname: string, search?: string): string {
  if (!search) return pathname;
  const q = search.startsWith('?') ? search : `?${search}`;
  return `${pathname}${q}`;
}

/** Public same-origin path stored in retail ?redirect= (checkout normalized). */
export function shopperPublicRedirectPath(pathname: string, search?: string): string {
  const base =
    pathname === '/checkout' || pathname === '/retail/checkout' ? '/checkout' : pathname;
  return safeAccountRedirect(appendSearch(base, search));
}

export function resolveShopperLoginUrl(
  pathname: string,
  hostname: string,
  search?: string,
): string {
  if (pathname.startsWith('/admin')) return '/admin/login';
  if (pathname.startsWith('/partners')) return '/partners/login';
  if (isSalesPartnerPanelPath(pathname)) return '/sales-partners/login';

  const retailish =
    hostLooksRetail(hostname) ||
    pathname.startsWith('/retail') ||
    pathname.startsWith('/account');

  if (retailish) {
    const redirect = shopperPublicRedirectPath(pathname, search);
    return `/account?redirect=${encodeURIComponent(redirect)}`;
  }

  const currentPath = appendSearch(pathname, search);
  const redirect = safeScopedRedirect(currentPath, '/portal/dashboard', [
    '/portal',
    '/checkout',
  ] as const);
  return `/portal/login?redirect=${encodeURIComponent(redirect)}`;
}

export function shouldSkipAuthRedirect(apiPath: string): boolean {
  return (
    apiPath.includes('/auth/login') ||
    apiPath.includes('/auth/retail') ||
    apiPath.includes('/otp/verify') ||
    apiPath.includes('/sales-partner-applications/verify')
  );
}
