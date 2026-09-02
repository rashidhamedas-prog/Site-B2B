import {
  ADMIN_ROLE_KEY,
  ADMIN_TOKEN_KEY,
  STOREFRONT_ROLE_KEY,
  STOREFRONT_TOKEN_KEY,
  isAdminPurposeToken,
} from './admin-session';
import { isStaffRole } from './staff-access';

export type AuthCookieScope = 'admin' | 'storefront';

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

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  if (isBrowserAdminPath()) {
    const token = localStorage.getItem(ADMIN_TOKEN_KEY);
    return isAdminPurposeToken(token) ? token : null;
  }
  return localStorage.getItem(STOREFRONT_TOKEN_KEY);
}

export function setToken(token: string, role: string, scope?: AuthCookieScope) {
  // Never infer admin from role. A shopper JWT can still say ADMIN in old
  // clients or if OTP regresses; that must stay in storefront keys.
  const resolved: AuthCookieScope = scope === 'admin' ? 'admin' : 'storefront';
  const maxAge = 7 * 24 * 60 * 60;
  if (resolved === 'admin') {
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
    localStorage.setItem(ADMIN_ROLE_KEY, role);
    writeCookie(ADMIN_TOKEN_KEY, token, maxAge);
    writeCookie(ADMIN_ROLE_KEY, role, maxAge);
    return;
  }
  localStorage.setItem(STOREFRONT_TOKEN_KEY, token);
  localStorage.setItem(STOREFRONT_ROLE_KEY, role);
  writeCookie(STOREFRONT_TOKEN_KEY, token, maxAge);
  writeCookie(STOREFRONT_ROLE_KEY, role, maxAge);
}

export function clearToken() {
  if (typeof window !== 'undefined' && isBrowserAdminPath()) {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_ROLE_KEY);
    clearCookie(ADMIN_TOKEN_KEY);
    clearCookie(ADMIN_ROLE_KEY);
    return;
  }
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
  return localStorage.getItem(STOREFRONT_ROLE_KEY);
}

export function isAdmin(): boolean {
  return isStaffRole(getRole());
}
