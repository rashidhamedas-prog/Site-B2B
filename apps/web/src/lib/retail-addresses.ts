/** Recent shipping addresses for retail checkout/account (browser localStorage). */

export type RetailAddress = {
  province: string;
  city: string;
  postalCode: string;
  street: string;
  recipient: string;
  mobile: string;
  savedAt?: string;
};

const KEY = 'taranom_retail_addresses';
const MAX = 5;

export function getRetailAddresses(): RetailAddress[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRetailAddress(addr: RetailAddress) {
  if (typeof window === 'undefined') return;
  const next: RetailAddress = { ...addr, savedAt: new Date().toISOString() };
  const prev = getRetailAddresses().filter(
    (a) =>
      !(
        a.street === next.street &&
        a.city === next.city &&
        a.postalCode === next.postalCode &&
        a.mobile === next.mobile
      ),
  );
  localStorage.setItem(KEY, JSON.stringify([next, ...prev].slice(0, MAX)));
}
