export type ProductSizeType = 'TWO' | 'THREE' | 'FREE';

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
