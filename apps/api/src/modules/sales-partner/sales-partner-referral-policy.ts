import { createHmac, timingSafeEqual } from 'crypto';

/** Existing storefront window. Changing it needs a written decision. */
export const REFERRAL_SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

/** New sessions per public code inside one minute. Stops unauthenticated insert floods. */
export const REFERRAL_CLICK_BURST_LIMIT = 40;

export function referralClickBurstAllowed(
  recentClicks: number,
  limit = REFERRAL_CLICK_BURST_LIMIT,
): boolean {
  return Number.isInteger(recentClicks) && recentClicks >= 0 && recentClicks < limit;
}

export type ReferralSessionClaims = {
  v: 1;
  sid: string;
  partnerId: string;
  publicCode: string;
  productIds: string[];
  exp: number;
};

export function referralSessionSecret(raw: string | undefined | null): string | null {
  const secret = String(raw ?? '').trim();
  return secret.length >= 32 ? secret : null;
}

function b64url(buf: Buffer): string {
  return buf.toString('base64url');
}

export function signReferralSession(claims: ReferralSessionClaims, secret: string): string {
  const body = b64url(Buffer.from(JSON.stringify(claims), 'utf8'));
  const mac = b64url(createHmac('sha256', secret).update(body).digest());
  return `${body}.${mac}`;
}

export function verifyReferralSession(
  token: string,
  secret: string,
  nowMs: number,
): ReferralSessionClaims | null {
  const parts = String(token || '').split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const expected = b64url(createHmac('sha256', secret).update(parts[0]).digest());
  const got = Buffer.from(parts[1]);
  const want = Buffer.from(expected);
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  let parsed: ReferralSessionClaims;
  try {
    parsed = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as ReferralSessionClaims;
  } catch {
    return null;
  }
  if (parsed?.v !== 1 || typeof parsed.sid !== 'string' || typeof parsed.exp !== 'number') return null;
  if (!/^[a-z0-9]{8}$/.test(String(parsed.publicCode || ''))) return null;
  if (!/^[0-9a-f-]{36}$/i.test(parsed.sid) || !/^[0-9a-f-]{36}$/i.test(parsed.partnerId)) return null;
  if (parsed.exp <= nowMs) return null;
  if (!Array.isArray(parsed.productIds)) return null;
  return {
    v: 1,
    sid: parsed.sid,
    partnerId: parsed.partnerId,
    publicCode: parsed.publicCode,
    productIds: parsed.productIds.filter((id) => typeof id === 'string').slice(0, 12),
    exp: parsed.exp,
  };
}

/** Gateway lock is separate from commission eligibility. */
export function referralPaymentDecision(input: {
  sessionValid: boolean;
  requestedMethod: string;
  requestedGateway?: string | null;
}): { exclusive: boolean; method: string; gateway: string | null; reject?: string } {
  if (!input.sessionValid) {
    return {
      exclusive: false,
      method: input.requestedMethod,
      gateway: input.requestedGateway ?? null,
    };
  }
  const method = String(input.requestedMethod || '').toUpperCase();
  const gateway = String(input.requestedGateway || '').toUpperCase();
  if (method === 'CASH' || method === 'INSTALLMENT' || gateway === 'DIGIPAY' || gateway === 'TOROBPAY') {
    return {
      exclusive: true,
      method: 'ONLINE',
      gateway: 'ZARINPAL',
      reject: 'خرید از لینک همکار بازاریاب فقط با پرداخت آنلاین زرین‌پال ممکن است',
    };
  }
  return { exclusive: true, method: 'ONLINE', gateway: 'ZARINPAL' };
}

export type StartSwitch =
  | { action: 'proceed' }
  | { action: 'reject'; message: string }
  | { action: 'block_inflight'; message: string };

/**
 * In-flight DigiPay/TorobPay attempts are never cancelled or moved.
 * A referral-locked order only accepts a new ZarinPal start.
 */
export function paymentStartSwitch(input: {
  exclusiveZarinpal: boolean;
  requested: string;
  pendingGateway: string | null;
}): StartSwitch {
  const requested = String(input.requested || 'ZARINPAL').toUpperCase();
  const pending = input.pendingGateway ? String(input.pendingGateway).toUpperCase() : null;
  if (input.exclusiveZarinpal && requested !== 'ZARINPAL') {
    return { action: 'reject', message: 'این سفارش فقط با زرین‌پال قابل پرداخت است' };
  }
  if (pending && (pending === 'DIGIPAY' || pending === 'TOROBPAY') && pending !== requested) {
    return {
      action: 'block_inflight',
      message: 'پرداخت در جریان با درگاه قبلی باز است و به زرین‌پال منتقل نمی‌شود',
    };
  }
  if (input.exclusiveZarinpal && pending && pending !== 'ZARINPAL') {
    return {
      action: 'block_inflight',
      message: 'پرداخت قبلی این سفارش هنوز باز است و بی‌صدا لغو نمی‌شود',
    };
  }
  return { action: 'proceed' };
}

export function isUniqueViolation(err: unknown): boolean {
  const row = err as { code?: string; driverError?: { code?: string } };
  return row?.code === '23505' || row?.driverError?.code === '23505';
}

export function missingSnapshotItemIds(existingItemIds: string[], orderItemIds: string[]): string[] {
  const have = new Set(existingItemIds);
  return orderItemIds.filter((id) => id && !have.has(id));
}

/**
 * payableIrr is the amount after discount. discountIrr is the discount already
 * removed from the list price and must be supplied so the caller cannot skip it.
 * goodsCostIrr / variableCostIrr are 0 when the catalog has no cost column.
 */
export function productMarginIrr(input: {
  payableIrr: number;
  discountIrr: number;
  goodsCostIrr: number;
  variableCostIrr: number;
  partnerCommissionIrr: number;
}): number {
  for (const [key, value] of Object.entries(input)) {
    if (!Number.isInteger(value) || value < 0) throw new Error(`INVALID_${key}`);
  }
  return input.payableIrr - input.goodsCostIrr - input.variableCostIrr - input.partnerCommissionIrr;
}

export function payoutCarryAllowed(availableIrr: number): { ok: true } | { ok: false; message: string } {
  if (!Number.isInteger(availableIrr)) return { ok: false, message: 'مانده نامعتبر است' };
  if (availableIrr <= 0) {
    return { ok: false, message: 'مانده منفی یا صفر پرداخت نمی‌شود و از درآمد بعدی کسر می‌شود' };
  }
  return { ok: true };
}

export function mergedClickedProducts(
  previousPartnerId: string | null,
  previousProductIds: string[],
  nextPartnerId: string,
  nextProductId: string,
): string[] {
  const base = previousPartnerId === nextPartnerId ? previousProductIds : [];
  return [...new Set([...base, nextProductId])].slice(-12);
}
