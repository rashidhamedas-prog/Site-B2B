import { timingSafeEqual } from 'crypto';

/** Fail-closed timing-safe compare; unequal lengths → false. */
export function timingSafeSecretEqual(expected: string, got: string): boolean {
  const a = Buffer.from(String(expected), 'utf8');
  const b = Buffer.from(String(got), 'utf8');
  if (a.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
