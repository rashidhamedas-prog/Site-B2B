import { isStaffRole } from './staff-access';

const TOKEN_KEY = 'taranom_token';
const ROLE_KEY = 'taranom_role';
const ADMIN_TOKEN_KEY = 'taranom_admin_token';
const ADMIN_ROLE_KEY = 'taranom_admin_role';

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
    return localStorage.getItem(ADMIN_TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
  }
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string, role: string, scope?: AuthCookieScope) {
  const resolved: AuthCookieScope = scope ?? (isStaffRole(role) ? 'admin' : 'storefront');
  const maxAge = 7 * 24 * 60 * 60;
  if (resolved === 'admin') {
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
    localStorage.setItem(ADMIN_ROLE_KEY, role);
    writeCookie(ADMIN_TOKEN_KEY, token, maxAge);
    writeCookie(ADMIN_ROLE_KEY, role, maxAge);
    return;
  }
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(ROLE_KEY, role);
  writeCookie(TOKEN_KEY, token, maxAge);
  writeCookie(ROLE_KEY, role, maxAge);
}

export function clearToken() {
  if (typeof window !== 'undefined' && isBrowserAdminPath()) {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_ROLE_KEY);
    clearCookie(ADMIN_TOKEN_KEY);
    clearCookie(ADMIN_ROLE_KEY);
    return;
  }
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
  clearCookie(TOKEN_KEY);
  clearCookie(ROLE_KEY);
}

export function getRole(): string | null {
  if (typeof window === 'undefined') return null;
  if (isBrowserAdminPath()) {
    return localStorage.getItem(ADMIN_ROLE_KEY) || localStorage.getItem(ROLE_KEY);
  }
  return localStorage.getItem(ROLE_KEY);
}

export function isAdmin(): boolean {
  return isStaffRole(getRole());
}
