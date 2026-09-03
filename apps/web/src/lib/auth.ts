import {
  ADMIN_ROLE_KEY,
  ADMIN_TOKEN_KEY,
  RETAIL_ROLE_KEY,
  RETAIL_TOKEN_KEY,
  STOREFRONT_ROLE_KEY,
  STOREFRONT_TOKEN_KEY,
  WHOLESALE_ROLE_KEY,
  WHOLESALE_TOKEN_KEY,
  cookieScopeFromPurpose,
  isAdminPurposeToken,
  shopperScopeFromLocation,
  type AuthCookieScope,
} from './admin-session';
import { isStaffRole } from './staff-access';

export type { AuthCookieScope };

function isBrowserAdminPath(): boolean {
  return typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');
}

function writeCookie(name: string, value: string, maxAge: number) {
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`;
}

function clearCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0`;
}

function currentShopperScope(): Exclude<AuthCookieScope, 'admin'> {
  if (typeof window === 'undefined') return 'wholesale';
  return shopperScopeFromLocation(window.location.pathname, window.location.hostname);
}

function shopperKeys(scope: Exclude<AuthCookieScope, 'admin'>) {
  if (scope === 'retail') {
    return { token: RETAIL_TOKEN_KEY, role: RETAIL_ROLE_KEY };
  }
  return { token: WHOLESALE_TOKEN_KEY, role: WHOLESALE_ROLE_KEY };
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  if (isBrowserAdminPath()) {
    const token = localStorage.getItem(ADMIN_TOKEN_KEY);
    return isAdminPurposeToken(token) ? token : null;
  }
  const keys = shopperKeys(currentShopperScope());
  return localStorage.getItem(keys.token) || localStorage.getItem(STOREFRONT_TOKEN_KEY);
}

export function setToken(token: string, role: string, scope?: AuthCookieScope | 'storefront') {
  const resolved: AuthCookieScope = scope === 'admin' || scope === 'retail' || scope === 'wholesale'
    ? scope
    : cookieScopeFromPurpose(scope);
  const maxAge = 7 * 24 * 60 * 60;
  if (resolved === 'admin') {
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
    localStorage.setItem(ADMIN_ROLE_KEY, role);
    writeCookie(ADMIN_TOKEN_KEY, token, maxAge);
    writeCookie(ADMIN_ROLE_KEY, role, maxAge);
    return;
  }
  const keys = shopperKeys(resolved);
  localStorage.setItem(keys.token, token);
  localStorage.setItem(keys.role, role);
  writeCookie(keys.token, token, maxAge);
  writeCookie(keys.role, role, maxAge);
}

export function clearToken() {
  if (typeof window !== 'undefined' && isBrowserAdminPath()) {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_ROLE_KEY);
    clearCookie(ADMIN_TOKEN_KEY);
    clearCookie(ADMIN_ROLE_KEY);
    return;
  }
  const keys = shopperKeys(currentShopperScope());
  localStorage.removeItem(keys.token);
  localStorage.removeItem(keys.role);
  clearCookie(keys.token);
  clearCookie(keys.role);
  localStorage.removeItem(STOREFRONT_TOKEN_KEY);
  localStorage.removeItem(STOREFRONT_ROLE_KEY);
  clearCookie(STOREFRONT_TOKEN_KEY);
  clearCookie(STOREFRONT_ROLE_KEY);
}

export function getRole(): string | null {
  if (typeof window === 'undefined') return null;
  if (isBrowserAdminPath()) {
    return localStorage.getItem(ADMIN_ROLE_KEY);
  }
  const keys = shopperKeys(currentShopperScope());
  return localStorage.getItem(keys.role) || localStorage.getItem(STOREFRONT_ROLE_KEY);
}

export function isAdmin(): boolean {
  return isStaffRole(getRole());
}
