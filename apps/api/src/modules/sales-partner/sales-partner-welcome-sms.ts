import { randomBytes } from 'crypto';
import { validateNewPassword } from '../auth/password-policy';

/** Avoid ambiguous chars (0/O, 1/l/I) for SMS readability. */
const TEMP_PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

export const WELCOME_SMS_COOLDOWN_MS = 15 * 60 * 1000;

export function generateSalesPartnerTempPassword(length = 10): string {
  const size = Math.max(8, Math.min(32, length));
  const bytes = randomBytes(size);
  let out = '';
  for (let i = 0; i < size; i += 1) {
    out += TEMP_PASSWORD_ALPHABET[bytes[i]! % TEMP_PASSWORD_ALPHABET.length];
  }
  return out;
}

/** Retry until policy passes (phone collision is extremely rare). */
export function generateValidSalesPartnerTempPassword(phone?: string, length = 10): string {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const password = generateSalesPartnerTempPassword(length);
    if (!validateNewPassword(password, phone)) return password;
  }
  // Last resort: append suffix that cannot equal phone
  const base = generateSalesPartnerTempPassword(Math.max(8, length - 2));
  return `${base}Ax`;
}

export function salesPartnerLoginUrl(retailOrigin?: string | null): string {
  const origin = String(retailOrigin || 'https://www.poshaktaranom.ir').replace(/\/$/, '');
  return `${origin}/sales-partners/login`;
}

export function welcomeSmsCooldownActive(
  lastSentAt: Date | null | undefined,
  nowMs = Date.now(),
  cooldownMs = WELCOME_SMS_COOLDOWN_MS,
): boolean {
  if (!lastSentAt) return false;
  return nowMs - lastSentAt.getTime() < cooldownMs;
}
