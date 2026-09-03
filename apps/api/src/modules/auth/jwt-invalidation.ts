/** JWT issued at `iat` (seconds) is dead if password changed in a later second. */

export function isJwtInvalidatedByPasswordChange(
  iat: number | undefined,
  passwordChangedAt: Date | null | undefined,
): boolean {
  if (!passwordChangedAt) return false;
  if (iat == null || !Number.isFinite(iat)) return true;
  return iat < Math.floor(passwordChangedAt.getTime() / 1000);
}
