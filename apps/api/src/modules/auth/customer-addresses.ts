import { createHash } from 'crypto';
import { normalizePhone } from './phone.util';

export type SavedAddress = {
  id: string;
  recipient: string;
  mobile: string;
  province: string;
  city: string;
  street: string;
  postalCode?: string;
  isDefault?: boolean;
};

export const MAX_SAVED_ADDRESSES = 10;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function trim(value: unknown, max: number): string {
  return String(value ?? '').trim().slice(0, max);
}

function hexToUuid(hex32: string): string {
  const hex = hex32.toLowerCase().padEnd(32, '0').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** Stable UUID for rows that never persisted an id, so GET and DELETE see the same value. */
export function addressFallbackId(raw: {
  recipient: string;
  mobile: string;
  province: string;
  city: string;
  street: string;
  postalCode?: string;
  occurrence?: number;
}): string {
  const key = [
    raw.recipient.trim().toLowerCase(),
    raw.mobile.trim(),
    raw.province.trim().toLowerCase(),
    raw.city.trim().toLowerCase(),
    raw.street.trim().toLowerCase(),
    (raw.postalCode || '').trim(),
    String(raw.occurrence ?? 1),
  ].join('|');
  const hex = createHash('sha1').update(key).digest('hex').slice(0, 32);
  return hexToUuid(hex);
}

function contentKey(raw: {
  recipient: string;
  mobile: string;
  province: string;
  city: string;
  street: string;
  postalCode?: string;
}): string {
  return [
    raw.recipient.trim().toLowerCase(),
    raw.mobile.trim(),
    raw.province.trim().toLowerCase(),
    raw.city.trim().toLowerCase(),
    raw.street.trim().toLowerCase(),
    (raw.postalCode || '').trim(),
  ].join('|');
}

export function sanitizeSavedAddress(
  raw: Partial<SavedAddress> & { mobile?: string },
  occurrence = 1,
): SavedAddress {
  const mobile = normalizePhone(String(raw.mobile ?? ''));
  if (!/^09\d{9}$/.test(mobile)) {
    throw new Error('شماره موبایل گیرنده معتبر نیست');
  }
  const recipient = trim(raw.recipient, 120);
  const province = trim(raw.province, 80);
  const city = trim(raw.city, 80);
  const street = trim(raw.street, 500);
  if (!recipient || !province || !city || !street) {
    throw new Error('گیرنده، استان، شهر و نشانی الزامی است');
  }
  const postal = trim(raw.postalCode, 20);
  const hasId = typeof raw.id === 'string' && UUID_RE.test(raw.id);
  return {
    id: hasId
      ? raw.id!
      : addressFallbackId({
          recipient,
          mobile,
          province,
          city,
          street,
          postalCode: postal || undefined,
          occurrence,
        }),
    recipient,
    mobile,
    province,
    city,
    street,
    postalCode: postal || undefined,
    isDefault: Boolean(raw.isDefault),
  };
}

export function normalizeAddressList(raw: unknown): SavedAddress[] {
  if (!Array.isArray(raw)) return [];
  const out: SavedAddress[] = [];
  const seen = new Map<string, number>();
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    try {
      const draft = row as SavedAddress;
      const mobile = normalizePhone(String(draft.mobile ?? ''));
      const key = contentKey({
        recipient: trim(draft.recipient, 120),
        mobile,
        province: trim(draft.province, 80),
        city: trim(draft.city, 80),
        street: trim(draft.street, 500),
        postalCode: trim(draft.postalCode, 20),
      });
      const occurrence = (seen.get(key) ?? 0) + 1;
      const saved = sanitizeSavedAddress(draft, occurrence);
      seen.set(key, occurrence);
      out.push(saved);
    } catch {
      // skip corrupt rows
    }
    if (out.length >= MAX_SAVED_ADDRESSES) break;
  }
  if (out.length && !out.some((a) => a.isDefault)) out[0]!.isDefault = true;
  return out;
}

export function upsertAddress(list: SavedAddress[], incoming: Partial<SavedAddress>): SavedAddress[] {
  if (list.length >= MAX_SAVED_ADDRESSES && !incoming.id) {
    throw new Error(`حداکثر ${MAX_SAVED_ADDRESSES} آدرس می‌توانید ذخیره کنید`);
  }
  const next = sanitizeSavedAddress(incoming);
  const existingIdx = list.findIndex((a) => a.id === next.id);
  const merged = existingIdx >= 0
    ? list.map((a, i) => (i === existingIdx ? next : a))
    : [...list, next];
  if (next.isDefault || merged.length === 1) {
    return merged.map((a) => ({ ...a, isDefault: a.id === next.id }));
  }
  return merged;
}

export function removeAddress(list: SavedAddress[], id: string): SavedAddress[] {
  const next = list.filter((a) => a.id !== id);
  if (next.length && !next.some((a) => a.isDefault)) next[0]!.isDefault = true;
  return next;
}
