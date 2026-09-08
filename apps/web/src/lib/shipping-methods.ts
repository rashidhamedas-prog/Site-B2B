export type ShippingMethodOption = { id: string; label: string };

export const IN_PERSON_SHIPPING_ID = 'IN_PERSON';

export const FALLBACK_RETAIL_SHIPPING_METHODS: ShippingMethodOption[] = [
  { id: 'PISHTAZ', label: 'پست پیشتاز' },
  { id: 'TIPAX', label: 'تیپاکس' },
  { id: 'CHAPAR', label: 'چاپار' },
  { id: 'TEHRAN_BIKE', label: 'پیک تهران' },
  { id: IN_PERSON_SHIPPING_ID, label: 'تحویل در محل' },
];

export function isInPersonShipping(id?: string): boolean {
  return String(id || '').toUpperCase() === IN_PERSON_SHIPPING_ID;
}

export function shippingChoiceDescription(
  id: string,
  opts?: { freeShipping?: boolean; wholesale?: boolean },
): string {
  if (isInPersonShipping(id)) return 'بدون هزینه ارسال — مراجعه به فروشگاه یا کارگاه';
  if (opts?.freeShipping) return 'ارسال این سفارش رایگان است';
  return opts?.wholesale
    ? 'هزینه طبق آستانه سفارش محاسبه می‌شود'
    : 'هزینه طبق مقصد و تعداد محاسبه می‌شود';
}

export function resolveShippingMethods(
  loaded: ShippingMethodOption[] | null | undefined,
  fallback: ShippingMethodOption[],
): ShippingMethodOption[] {
  const list = Array.isArray(loaded)
    ? loaded.filter((m) => m && typeof m.id === 'string' && typeof m.label === 'string' && m.id.trim())
    : [];
  return list.length ? list : fallback;
}
