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
