import { normalizeDigits } from '../auth/phone.util';

/** Sender / office postal for parcel labels. ASCII digits only, max 10. Not a mobile. */
export function normalizeBusinessPostal(raw: unknown): string {
  const digits = normalizeDigits(String(raw ?? ''));
  if (digits.startsWith('09')) return '';
  return digits.slice(0, 10);
}
