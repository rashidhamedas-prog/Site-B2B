/** Browser-safe phone / OTP normalize (mirrors apps/api auth/phone.util). */

export function normalizeDigits(raw: string): string {
  return String(raw || '')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/\D/g, '');
}

export function normalizePhone(raw: string): string {
  const digits = normalizeDigits(raw);
  if (digits.startsWith('98') && digits.length === 12) return `0${digits.slice(2)}`;
  if (digits.length === 10 && digits.startsWith('9')) return `0${digits}`;
  return digits;
}

export function normalizeOtpCode(raw: string): string {
  return normalizeDigits(raw);
}
