export type ShippingMethodOption = { id: string; label: string };

export const FALLBACK_RETAIL_SHIPPING_METHODS: ShippingMethodOption[] = [
  { id: 'PISHTAZ', label: 'پست پیشتاز' },
  { id: 'TIPAX', label: 'تیپاکس' },
  { id: 'CHAPAR', label: 'چاپار' },
  { id: 'TEHRAN_BIKE', label: 'پیک تهران' },
];

export function resolveShippingMethods(
  loaded: ShippingMethodOption[] | null | undefined,
  fallback: ShippingMethodOption[],
): ShippingMethodOption[] {
  const list = Array.isArray(loaded)
    ? loaded.filter((m) => m && typeof m.id === 'string' && typeof m.label === 'string' && m.id.trim())
    : [];
  return list.length ? list : fallback;
}
