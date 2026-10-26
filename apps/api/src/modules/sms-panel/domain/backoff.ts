/** Exponential backoff with ±20% jitter. base=30s, max=15m, max 5 attempts. */

export const SMS_RETRY_BASE_MS = 30_000;
export const SMS_RETRY_MAX_MS = 15 * 60_000;
export const SMS_RETRY_MAX_ATTEMPTS = 5;

export function backoffDelayMs(
  attempt: number,
  opts?: { baseMs?: number; maxMs?: number; random?: () => number },
): number {
  const base = opts?.baseMs ?? SMS_RETRY_BASE_MS;
  const max = opts?.maxMs ?? SMS_RETRY_MAX_MS;
  const rnd = opts?.random ?? Math.random;
  const exp = Math.min(base * Math.pow(2, Math.max(0, attempt)), max);
  const jitter = exp * 0.2 * (rnd() * 2 - 1); // ±20%
  return Math.max(0, Math.round(exp + jitter));
}

export function isRetryableErrorCode(
  code: string | undefined,
): boolean {
  return (
    code === 'TIMEOUT' ||
    code === 'NETWORK' ||
    code === 'HTTP' ||
    code === 'RATE_LIMITED' ||
    code === '5xx'
  );
}
