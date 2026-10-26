/** Prefer dedicated attribution HMAC key; fall back to JWT_SECRET. */
export function resolveSalesPartnerAttrSecret(
  attrSecret: string | null | undefined,
  jwtSecret: string | null | undefined,
): string {
  const dedicated = String(attrSecret || '').trim();
  if (dedicated) return dedicated;
  const fallback = String(jwtSecret || '').trim();
  if (fallback) return fallback;
  throw new Error('ATTR_SECRET_MISSING');
}
