/**
 * PR-14 PII helpers — mask Iranian mobiles in stored text / forwards.
 * Never log or persist full 09xxxxxxxxx in body/bodyPreview/statePayload.
 */

const IR_MOBILE = /09\d{9}/g;

export function maskIranianMobiles(text: unknown): string {
  return String(text ?? '').replace(IR_MOBILE, (m) => `${m.slice(0, 4)}***${m.slice(-2)}`);
}

export function phoneLast4(phone: unknown): string {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (digits.length < 4) return '';
  return digits.slice(-4);
}

export function maskPhoneDisplay(phone: unknown): string {
  const raw = String(phone ?? '').replace(/\D/g, '');
  if (raw.length < 6) return '***';
  return `${raw.slice(0, 4)}***${raw.slice(-2)}`;
}

/** Safe customerInfo for statePayload — phones already masked. */
export function sanitizeCustomerInfoForStorage(text: unknown, max = 200): string {
  return maskIranianMobiles(text).slice(0, max);
}
