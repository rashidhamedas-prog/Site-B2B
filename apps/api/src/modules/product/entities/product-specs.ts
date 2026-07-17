export type ProductSizeType = 'TWO' | 'THREE' | 'FREE';

export interface ProductCustomField {
  key: string;
  label: string;
  value: string;
}

/** Structured product specifications (توضیحات محصول) */
export interface ProductSpecs {
  fabricType?: string;
  packQty?: string;
  length?: string;
  length2?: string;
  chestWidth?: string;
  sleeveModel?: string;
  buttonModel?: string;
  collarModel?: string;
  customFields?: ProductCustomField[];
}

export const SPEC_FIELD_KEYS = [
  'fabricType',
  'packQty',
  'length',
  'length2',
  'chestWidth',
  'sleeveModel',
  'buttonModel',
  'collarModel',
] as const;

export type SpecFieldKey = (typeof SPEC_FIELD_KEYS)[number];

export const SIZE_GUIDE: Record<ProductSizeType, string[]> = {
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
