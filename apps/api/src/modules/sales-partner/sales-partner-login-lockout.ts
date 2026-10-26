export const SALES_PARTNER_LOGIN_MAX_FAILS = 5;
export const SALES_PARTNER_LOGIN_WINDOW_SEC = 15 * 60;

export function salesPartnerLoginFailKey(phone: string, ip: string): string {
  const safePhone = String(phone || '').replace(/\D/g, '').slice(-15) || 'unknown';
  const safeIp = String(ip || 'unknown').trim().toLowerCase().slice(0, 64) || 'unknown';
  return `sp-login-fail:${safePhone}:${safeIp}`;
}

/** After MAX_FAILS failures inside the window, the next attempt is locked (even if password is correct). */
export function isSalesPartnerLoginLocked(failCount: number | null | undefined): boolean {
  return Number(failCount || 0) >= SALES_PARTNER_LOGIN_MAX_FAILS;
}
