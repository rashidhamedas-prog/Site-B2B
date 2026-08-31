export const OPPOSITE_CHANNEL_PUBLIC_KEYS = {
  RETAIL: [
    'wholesaleStock',
    'wholesalePrice',
    'wholesaleCompareAtPrice',
    'wholesaleSalePrice',
    'wholesaleFullContent',
    'wholesaleIsDiscounted',
    'wholesaleDiscountType',
    'wholesaleDiscountPercent',
    'wholesaleDiscountAmount',
    'wholesaleDiscountStartsAt',
    'wholesaleDiscountEndsAt',
    'allowWholesaleColorSelect',
    'minWholesaleColors',
  ],
  WHOLESALE: [
    'retailStock',
    'retailPrice',
    'retailCompareAtPrice',
    'retailSalePrice',
    'retailFullContent',
    'retailIsDiscounted',
    'retailDiscountType',
    'retailDiscountPercent',
    'retailDiscountAmount',
    'retailDiscountStartsAt',
    'retailDiscountEndsAt',
    'defaultRetailVariantId',
  ],
} as const;

export function resolvePublicProductChannel(
  channel?: string | null,
  admin = false,
): 'RETAIL' | 'WHOLESALE' | undefined {
  const ch = String(channel || '').toUpperCase();
  if (ch === 'RETAIL' || ch === 'WHOLESALE') return ch;
  if (admin && !ch) return undefined;
  throw new Error('PUBLIC_CHANNEL_REQUIRED');
}

export function stripOppositeChannelFields<T extends object>(
  row: T,
  channel: 'RETAIL' | 'WHOLESALE',
): T {
  const rec = row as Record<string, unknown>;
  for (const key of OPPOSITE_CHANNEL_PUBLIC_KEYS[channel]) {
    delete rec[key];
  }
  return row;
}
