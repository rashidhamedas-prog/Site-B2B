import { normalizeDigits } from '../auth/phone.util';
import { sanitizeBusinessSeoFields } from './settings-seo';

/** Sender / office postal for parcel labels. ASCII digits only, max 10. Not a mobile. */
export function normalizeBusinessPostal(raw: unknown): string {
  const digits = normalizeDigits(String(raw ?? ''));
  if (digits.startsWith('09')) return '';
  return digits.slice(0, 10);
}

export function normalizeBusinessSettings(value: Record<string, unknown>): Record<string, unknown> {
  const seoSafe = sanitizeBusinessSeoFields(value);
  return {
    ...seoSafe,
    postalCode: normalizeBusinessPostal(seoSafe.postalCode),
  };
}
