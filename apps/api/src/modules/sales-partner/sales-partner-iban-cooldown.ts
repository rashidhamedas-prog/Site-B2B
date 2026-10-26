export const DEFAULT_SALES_PARTNER_IBAN_COOLDOWN_HOURS = 72;

export function resolveIbanCooldownHours(raw: string | number | null | undefined): number {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_SALES_PARTNER_IBAN_COOLDOWN_HOURS;
  return Math.floor(n);
}

export function ibanPayoutBlockedUntil(
  ibanChangedAt: Date | null | undefined,
  cooldownHours: number,
  now = new Date(),
): Date | null {
  if (!ibanChangedAt || cooldownHours <= 0) return null;
  const until = new Date(ibanChangedAt.getTime() + cooldownHours * 60 * 60 * 1000);
  return until.getTime() > now.getTime() ? until : null;
}
