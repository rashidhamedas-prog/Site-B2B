import { createHash, timingSafeEqual } from 'crypto';

export function hashSmsToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export function otpHashMatches(stored: string, otp: string): boolean {
  const expected = hashSmsToken(otp);
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(stored, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Strip non-digits; normalize Persian/Arabic digits to Latin. */
export function normalizeCampaignOtp(otp: string): string {
  return String(otp || '')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/\D/g, '');
}

export function isValidCampaignOtpLength(normalizedOtp: string): boolean {
  return normalizedOtp.length === 6;
}
