/** Fallback when API omits cooldown (retail default). Sales-partner apply uses 120 from API. */
export const DEFAULT_SMS_COOLDOWN = 60;
export const DEFAULT_SALES_PARTNER_SMS_COOLDOWN = 120;

type CooldownFields = {
  remainingSeconds?: number;
  cooldownSeconds?: number;
  retryAfter?: number;
};

export function extractSmsCooldown(
  err: unknown,
  success?: { cooldownSeconds?: number; remainingSeconds?: number },
): number {
  if (success?.remainingSeconds != null && success.remainingSeconds > 0) {
    return Math.ceil(success.remainingSeconds);
  }
  if (success?.cooldownSeconds != null && success.cooldownSeconds > 0) {
    return Math.ceil(success.cooldownSeconds);
  }
  if (err && typeof err === 'object') {
    const e = err as CooldownFields;
    if (e.remainingSeconds != null && e.remainingSeconds > 0) return Math.ceil(e.remainingSeconds);
    if (e.retryAfter != null && e.retryAfter > 0) return Math.ceil(e.retryAfter);
    if (e.cooldownSeconds != null && e.cooldownSeconds > 0) return Math.ceil(e.cooldownSeconds);
  }
  return DEFAULT_SMS_COOLDOWN;
}

/** Null when the payload has no cooldown, so a normal error does not start a fake timer. */
export function readSmsCooldownSeconds(source: unknown): number | null {
  if (!source || typeof source !== 'object') return null;
  const row = source as CooldownFields;
  if (row.remainingSeconds != null && row.remainingSeconds > 0) return Math.ceil(row.remainingSeconds);
  if (row.retryAfter != null && row.retryAfter > 0) return Math.ceil(row.retryAfter);
  if (row.cooldownSeconds != null && row.cooldownSeconds > 0) return Math.ceil(row.cooldownSeconds);
  return null;
}

export function formatOtpValidity(totalSeconds: number): string {
  const seconds = Math.max(0, Math.ceil(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  const fa = (n: number) => n.toLocaleString('fa-IR');
  if (minutes <= 0) return `${fa(rest)} ثانیه`;
  if (rest === 0) return `${fa(minutes)} دقیقه`;
  return `${fa(minutes)} دقیقه و ${fa(rest)} ثانیه`;
}
