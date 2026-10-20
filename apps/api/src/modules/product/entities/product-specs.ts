export type ProductSizeType = 'TWO' | 'THREE' | 'FREE' | 'CUSTOM';

export interface ProductCustomField {
  key: string;
  label: string;
  value: string;
}

/** Structured product specifications (توضیحات محصول) */
export interface ProductSpecs {
  fabricType?: string;
  /** جزئیات طراحی: یقه، دکمه، برش و … */
  designDetails?: string;
  /** مشخصات پکیج: مثلاً مانتو + شلوار */
  packageSpecs?: string;
  /** نشان ویژه تولید */
  manufacturingBadge?: string;
  packQty?: string;
  length?: string;
  length2?: string;
  length3?: string;
  chestWidth?: string;
  sleeveModel?: string;
  buttonModel?: string;
  collarModel?: string;
  customFields?: ProductCustomField[];
}

export const SPEC_FIELD_KEYS = [
  'fabricType',
  'designDetails',
  'packageSpecs',
  'manufacturingBadge',
  'packQty',
  'length',
  'length2',
  'length3',
  'chestWidth',
  'sleeveModel',
  'buttonModel',
  'collarModel',
] as const;

export type SpecFieldKey = (typeof SPEC_FIELD_KEYS)[number];

export const SIZE_GUIDE: Record<Exclude<ProductSizeType, 'CUSTOM'>, string[]> = {
  TWO: [
    'سایز ۱ مناسب ۳۸ تا ۴۲',
    'سایز ۲ مناسب ۴۲ تا ۴۸',
  ],
  THREE: [
    'سایز ۱ مناسب از ۳۸ تا ۴۰',
    'سایز ۲ مناسب از ۴۲ تا ۴۴',
    'سایز ۳ مناسب از ۴۶ تا ۴۸',
  ],
  FREE: [
    'مناسب از ۳۸ تا ۴۸',
  ],
};

/** Prefer admin guide lines; else preset guide; else custom labels as plain lines. */
export function resolveSizeGuide(
  sizeType?: string | null,
  sizeGuideLines?: string[] | null,
  sizeLabels?: string[] | null,
): string[] {
  const custom = (sizeGuideLines ?? []).map((s) => String(s || '').trim()).filter(Boolean);
  if (custom.length) return custom;
  const t = String(sizeType || 'FREE').toUpperCase() as ProductSizeType;
  if (t === 'CUSTOM') {
    return (sizeLabels ?? []).map((s) => String(s || '').trim()).filter(Boolean);
  }
  if (t === 'TWO' || t === 'THREE' || t === 'FREE') {
    return SIZE_GUIDE[t];
  }
  return SIZE_GUIDE.FREE;
}
