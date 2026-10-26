/** Persian/Arabic digits → Latin, then Iran mobile normalize to 09xxxxxxxxx. */

const DIGIT_MAP: Record<string, string> = {
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
};

export function toLatinDigits(raw: string): string {
  return String(raw || '').replace(/[۰-۹٠-٩]/g, (ch) => DIGIT_MAP[ch] ?? ch);
}

export function normalizeIranMobileStrict(raw?: string | null): string | null {
  const latin = toLatinDigits(String(raw || ''));
  const d = latin.replace(/\D/g, '');
  let phone = d;
  if (phone.startsWith('0098')) phone = phone.slice(4);
  else if (phone.startsWith('98') && phone.length >= 12) phone = phone.slice(2);
  if (phone.length === 10 && phone.startsWith('9')) phone = `0${phone}`;
  if (/^09\d{9}$/.test(phone)) return phone;
  return null;
}

export function isValidIranMobile(raw?: string | null): boolean {
  return normalizeIranMobileStrict(raw) != null;
}

/** Mask for audit/logs/UI: 0912***4567 */
export function maskMobile(phone: string): string {
  const n = normalizeIranMobileStrict(phone) || String(phone || '').replace(/\D/g, '');
  if (n.length < 8) return '***';
  return `${n.slice(0, 4)}***${n.slice(-4)}`;
}
