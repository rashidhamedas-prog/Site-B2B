/**
 * PR-14 in-memory rate limit per (provider, customerChatId).
 * Soft block + Persian notice; does not advance FSM when tripped.
 */

export const DEFAULT_BOT_RATE_LIMIT_PER_MIN = 12;
export const DEFAULT_BOT_RATE_BURST = 20;

export type RateLimitBucket = {
  windowStartMs: number;
  count: number;
};

const buckets = new Map<string, RateLimitBucket>();

export function rateLimitKey(provider: string, customerChatId: string): string {
  return `${String(provider || '').toUpperCase()}::${String(customerChatId || '').trim()}`;
}

export function resetBotRateLimitForTests(): void {
  buckets.clear();
}

export type RateLimitDecision =
  | { allowed: true; remaining: number }
  | { allowed: false; remaining: 0; notice: string };

export function checkBotRateLimit(input: {
  provider: string;
  customerChatId: string;
  nowMs?: number;
  perMinute?: number;
  burst?: number;
}): RateLimitDecision {
  const perMinute = Math.max(1, Number(input.perMinute) || DEFAULT_BOT_RATE_LIMIT_PER_MIN);
  const burst = Math.max(perMinute, Number(input.burst) || DEFAULT_BOT_RATE_BURST);
  const now = input.nowMs ?? Date.now();
  const key = rateLimitKey(input.provider, input.customerChatId);
  if (!String(input.customerChatId || '').trim()) {
    return { allowed: true, remaining: perMinute };
  }
  let bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStartMs >= 60_000) {
    bucket = { windowStartMs: now, count: 0 };
    buckets.set(key, bucket);
  }
  if (bucket.count >= burst || bucket.count >= perMinute) {
    return {
      allowed: false,
      remaining: 0,
      notice: 'لطفاً کمی صبر کنید و دوباره پیام بفرستید.',
    };
  }
  bucket.count += 1;
  return { allowed: true, remaining: Math.max(0, perMinute - bucket.count) };
}
