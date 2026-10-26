export const SALES_PARTNER_LOGIN_MAX_FAILS = 5;
export const SALES_PARTNER_LOGIN_PHONE_MAX_FAILS = 20;
export const SALES_PARTNER_LOGIN_WINDOW_SEC = 15 * 60;

function safePhoneDigits(phone: string): string {
  return String(phone || '').replace(/\D/g, '').slice(-15) || 'unknown';
}

export function salesPartnerLoginFailKey(phone: string, ip: string): string {
  const safeIp = String(ip || 'unknown').trim().toLowerCase().slice(0, 64) || 'unknown';
  return `sp-login-fail:${safePhoneDigits(phone)}:${safeIp}`;
}

/** Account-wide lockout — survives IP spoofing / multi-IP spray. */
export function salesPartnerLoginPhoneFailKey(phone: string): string {
  return `sp-login-fail-phone:${safePhoneDigits(phone)}`;
}

/** After MAX_FAILS failures inside the window, the next attempt is locked (even if password is correct). */
export function isSalesPartnerLoginLocked(failCount: number | null | undefined): boolean {
  return Number(failCount || 0) >= SALES_PARTNER_LOGIN_MAX_FAILS;
}

export function isSalesPartnerPhoneLoginLocked(failCount: number | null | undefined): boolean {
  return Number(failCount || 0) >= SALES_PARTNER_LOGIN_PHONE_MAX_FAILS;
}
