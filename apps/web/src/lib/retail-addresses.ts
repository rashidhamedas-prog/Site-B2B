/** Recent shipping addresses for retail checkout/account (browser localStorage). */

import { addressesMatch, hydrateShippingAddress, type ShippingAddress } from './shipping-address';

export type RetailAddress = ShippingAddress & {
  id?: string;
  isDefault?: boolean;
  savedAt?: string;
};

const KEY = 'taranom_retail_addresses';
const MAX = 5;

export function toRetailAddress(raw: Partial<RetailAddress> | null | undefined): RetailAddress {
  const hydrated = hydrateShippingAddress(raw);
  return {
    ...hydrated,
    id: typeof raw?.id === 'string' ? raw.id : undefined,
    isDefault: Boolean(raw?.isDefault),
    savedAt: typeof raw?.savedAt === 'string' ? raw.savedAt : undefined,
  };
}

export function getRetailAddresses(): RetailAddress[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map((row) => toRetailAddress(row)) : [];
  } catch {
    return [];
  }
}

export function saveRetailAddress(addr: RetailAddress) {
  if (typeof window === 'undefined') return;
  const next: RetailAddress = { ...toRetailAddress(addr), savedAt: new Date().toISOString() };
  const prev = getRetailAddresses().filter((a) => !addressesMatch(a, next));
  localStorage.setItem(KEY, JSON.stringify([next, ...prev].slice(0, MAX)));
}

export function replaceRetailAddresses(list: RetailAddress[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(list.map(toRetailAddress).slice(0, MAX)));
}

export function sameRetailAddress(a: Partial<RetailAddress>, b: Partial<RetailAddress>): boolean {
  return addressesMatch(a, b);
}
