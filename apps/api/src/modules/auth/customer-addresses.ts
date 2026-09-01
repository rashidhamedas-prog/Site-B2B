import { randomUUID } from 'crypto';
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

function trim(value: unknown, max: number): string {
  return String(value ?? '').trim().slice(0, max);
}

export function sanitizeSavedAddress(raw: Partial<SavedAddress> & { mobile?: string }): SavedAddress {
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
  return {
    id: raw.id && /^[0-9a-f-]{36}$/i.test(raw.id) ? raw.id : randomUUID(),
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
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    try {
      out.push(sanitizeSavedAddress(row as SavedAddress));
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
