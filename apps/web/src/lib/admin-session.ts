/** Cookie / localStorage keys for staff vs shopper sessions. Keep in sync with auth.ts. */

import { hostLooksRetail } from './channel';
import { isStaffRole } from './staff-access';

export const ADMIN_TOKEN_KEY = 'taranom_admin_token';
export const ADMIN_ROLE_KEY = 'taranom_admin_role';
export const STOREFRONT_TOKEN_KEY = 'taranom_token';
export const STOREFRONT_ROLE_KEY = 'taranom_role';
export const RETAIL_TOKEN_KEY = 'taranom_retail_token';
export const RETAIL_ROLE_KEY = 'taranom_retail_role';
export const WHOLESALE_TOKEN_KEY = 'taranom_wholesale_token';
export const WHOLESALE_ROLE_KEY = 'taranom_wholesale_role';

export type AuthCookieScope = 'admin' | 'retail' | 'wholesale';

export type CookieGetter = {
  get(name: string): { value: string } | undefined;
};

/**
 * Admin gate must use the staff cookie only.
 * A shopper JWT has purpose=retail|wholesale|storefront and RolesGuard returns 403 on every admin API.
 */
export function readAdminGateCookies(cookies: CookieGetter): {
  token: string | undefined;
  role: string | undefined;
} {
  return {
    token: cookies.get(ADMIN_TOKEN_KEY)?.value,
    role: cookies.get(ADMIN_ROLE_KEY)?.value,
  };
}

export function cookieScopeFromPurpose(purpose?: string | null): AuthCookieScope {
  if (purpose === 'admin') return 'admin';
  if (purpose === 'retail') return 'retail';
  return 'wholesale';
}

export function shopperScopeFromLocation(
  pathname: string,
  hostname?: string | null,
): Exclude<AuthCookieScope, 'admin'> {
  if (pathname.startsWith('/portal')) return 'wholesale';
  if (
    pathname === '/account' ||
    pathname.startsWith('/account/') ||
    pathname === '/retail' ||
    pathname.startsWith('/retail/')
  ) {
    return 'retail';
  }
  return hostLooksRetail(hostname) ? 'retail' : 'wholesale';
}

function readJwtPayload(token: string | null | undefined): {
  purpose?: unknown;
  role?: unknown;
} | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
    return JSON.parse(atob(b64 + pad)) as { purpose?: unknown; role?: unknown };
  } catch {
    return null;
  }
}

export function readJwtPurpose(token: string | null | undefined): string | undefined {
  const purpose = readJwtPayload(token)?.purpose;
  return typeof purpose === 'string' ? purpose : undefined;
}

export function isAdminPurposeToken(token: string | null | undefined): boolean {
  return readJwtPurpose(token) === 'admin';
}

export function canEnterAdmin(
  token: string | null | undefined,
  role: string | null | undefined,
): boolean {
  if (!isAdminPurposeToken(token)) return false;
  const payloadRole = readJwtPayload(token)?.role;
  if (typeof payloadRole === 'string' && isStaffRole(payloadRole)) return true;
  return isStaffRole(role);
}

export function isAdminAuthFailureMessage(message: string): boolean {
  return message.includes('فقط مدیر کل') || message.includes('دسترسی غیرمجاز');
}

export function readPortalGateCookies(cookies: CookieGetter): {
  token: string | undefined;
  role: string | undefined;
} {
  return {
    token: cookies.get(WHOLESALE_TOKEN_KEY)?.value || cookies.get(STOREFRONT_TOKEN_KEY)?.value,
    role: cookies.get(WHOLESALE_ROLE_KEY)?.value || cookies.get(STOREFRONT_ROLE_KEY)?.value,
  };
}
