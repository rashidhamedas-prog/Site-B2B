export type CatalogFilterValues = {
  fabric?: string;
  color?: string;
  size?: string;
  collar?: string;
  collectionId?: string;
  minPrice?: string;
  maxPrice?: string;
  inStock?: string;
};

export type CatalogFilterChip = {
  key: keyof CatalogFilterValues;
  label: string;
  value: string;
};

export const CATALOG_FABRICS = [
  'لینن',
  'کتان',
  'مازاراتی',
  'شال',
  'مموری',
  'پشمی',
  'فوتر',
  'لینن‌کتان',
  'ویسکوز',
] as const;

export const CATALOG_SIZE_TYPES = [
  { value: 'FREE', label: 'فری‌سایز', hint: 'یک سایز' },
  { value: 'TWO', label: 'دو سایز', hint: 'سایز ۱ و ۲' },
  { value: 'THREE', label: 'سه سایز', hint: 'سایز ۱ تا ۳' },
] as const;

export const CATALOG_COLOR_SWATCHES: ReadonlyArray<{ name: string; hex: string }> = [
  { name: 'سفید', hex: '#FFFFFF' },
  { name: 'مشکی', hex: '#111111' },
  { name: 'کرم', hex: '#F5F0E6' },
  { name: 'بژ', hex: '#D4A574' },
  { name: 'سرمه‌ای', hex: '#1B2A4A' },
  { name: 'خاکستری', hex: '#808080' },
  { name: 'قهوه‌ای', hex: '#8B4513' },
  { name: 'زرشکی', hex: '#800020' },
  { name: 'زیتونی', hex: '#556B2F' },
  { name: 'آبی', hex: '#3B82F6' },
  { name: 'صورتی', hex: '#F9A8D4' },
  { name: 'خردلی', hex: '#D4A017' },
];

const SIZE_LABEL: Record<string, string> = {
  FREE: 'فری‌سایز',
  TWO: 'دو سایز',
  THREE: 'سه سایز',
};

const CHIP_TITLES: Record<keyof CatalogFilterValues, string> = {
  fabric: 'پارچه',
  color: 'رنگ',
  size: 'سایز',
  collar: 'یقه',
  collectionId: 'کالکشن',
  minPrice: 'از',
  maxPrice: 'تا',
  inStock: 'موجودی',
};

export function catalogColorHex(name: string, fallback?: string): string {
  const match = CATALOG_COLOR_SWATCHES.find((row) => row.name === name.trim());
  if (match) return match.hex;
  const extra = (fallback || '').trim();
  return extra || '#D6D3D1';
}

export function isLightCatalogSwatch(hex: string): boolean {
  const raw = hex.replace('#', '');
  if (raw.length !== 3 && raw.length !== 6) return false;
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((ch) => ch + ch)
          .join('')
      : raw;
  const n = Number.parseInt(full, 16);
  if (!Number.isFinite(n)) return false;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const luma = (r * 299 + g * 587 + b * 114) / 1000;
  return luma >= 180;
}

export function catalogSizeLabel(value: string): string {
  return SIZE_LABEL[value] || value;
}

export function catalogActiveFilterCount(values: CatalogFilterValues): number {
  return catalogFilterChips(values).length;
}

export function catalogFilterChips(
  values: CatalogFilterValues,
  collectionName?: string,
): CatalogFilterChip[] {
  const chips: CatalogFilterChip[] = [];
  if (values.inStock === '1' || values.inStock === 'true') {
    chips.push({ key: 'inStock', value: '1', label: 'فقط موجود' });
  }
  if (values.fabric) {
    chips.push({ key: 'fabric', value: values.fabric, label: `${CHIP_TITLES.fabric}: ${values.fabric}` });
  }
  if (values.size) {
    chips.push({
      key: 'size',
      value: values.size,
      label: `${CHIP_TITLES.size}: ${catalogSizeLabel(values.size)}`,
    });
  }
  if (values.color) {
    chips.push({ key: 'color', value: values.color, label: `${CHIP_TITLES.color}: ${values.color}` });
  }
  if (values.minPrice) {
    chips.push({ key: 'minPrice', value: values.minPrice, label: `از ${values.minPrice} تومان` });
  }
  if (values.maxPrice) {
    chips.push({ key: 'maxPrice', value: values.maxPrice, label: `تا ${values.maxPrice} تومان` });
  }
  if (values.collectionId) {
    chips.push({
      key: 'collectionId',
      value: values.collectionId,
      label: collectionName ? `کالکشن: ${collectionName}` : 'کالکشن انتخاب‌شده',
    });
  }
  if (values.collar) {
    chips.push({ key: 'collar', value: values.collar, label: `${CHIP_TITLES.collar}: ${values.collar}` });
  }
  return chips;
}

export function mergeCatalogFabrics(extra: string[] = []): string[] {
  const seen = new Set<string>([...CATALOG_FABRICS]);
  const out: string[] = [...CATALOG_FABRICS];
  for (const name of extra) {
    const trimmed = name.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

export function mergeCatalogColors(extra: string[] = []): Array<{ name: string; hex: string }> {
  const seen = new Set(CATALOG_COLOR_SWATCHES.map((row) => row.name));
  const out = [...CATALOG_COLOR_SWATCHES];
  for (const name of extra) {
    const trimmed = name.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push({ name: trimmed, hex: catalogColorHex(trimmed) });
  }
  return out;
}

export function toggleCatalogValue(current: string | undefined, next: string): string {
  return current === next ? '' : next;
}
