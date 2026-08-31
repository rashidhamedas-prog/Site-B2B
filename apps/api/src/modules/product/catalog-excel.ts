import { buildXlsx, type ExcelCell, type ExcelSheet } from '../../common/xlsx-builder';
import { computePackQty, minOrderPieces } from './product-pack';
import { resolveChannelSale } from './product-sale';
import type { ProductSpecs } from './entities/product-specs';

export const WHOLESALE_ORIGIN = 'https://poshaktaranom.com';
export const RETAIL_ORIGIN = 'https://www.poshaktaranom.ir';

export type ExportChannel = 'WHOLESALE' | 'RETAIL' | 'ALL';

export function parseExportChannel(raw?: string | null): ExportChannel {
  const v = String(raw || 'ALL').trim().toUpperCase();
  if (v === 'WHOLESALE' || v === 'RETAIL' || v === 'ALL') return v;
  throw new Error('کانال خروجی باید WHOLESALE، RETAIL یا ALL باشد');
}

export function irrToToman(irr: unknown): number | '' {
  if (irr == null || irr === '') return '';
  const n = Number(irr);
  if (!Number.isFinite(n)) return '';
  return Math.round(n / 10);
}

export function yesNo(value: unknown): string {
  return value ? 'بله' : 'خیر';
}

export function formatTehran(value?: Date | string | null): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('sv-SE', { timeZone: 'Asia/Tehran' });
}

function joinList(values: Array<string | null | undefined>, sep = ' | '): string {
  return values.map((v) => String(v || '').trim()).filter(Boolean).join(sep);
}

function faqText(items?: Array<{ question?: string; answer?: string }> | null): string {
  if (!items?.length) return '';
  return items
    .map((f) => {
      const q = String(f?.question || '').trim();
      const a = String(f?.answer || '').trim();
      if (!q && !a) return '';
      return `س: ${q} / ج: ${a}`;
    })
    .filter(Boolean)
    .join(' || ');
}

function specsText(specs?: ProductSpecs | null): Record<string, string> {
  const s = specs || {};
  const custom = (s.customFields || [])
    .map((f) => {
      const label = String(f?.label || '').trim();
      const value = String(f?.value || '').trim();
      return label && value ? `${label}: ${value}` : '';
    })
    .filter(Boolean)
    .join(' | ');
  return {
    fabricType: String(s.fabricType || ''),
    designDetails: String(s.designDetails || ''),
    packageSpecs: String(s.packageSpecs || ''),
    manufacturingBadge: String(s.manufacturingBadge || ''),
    packQtySpec: String(s.packQty || ''),
    length: String(s.length || ''),
    length2: String(s.length2 || ''),
    length3: String(s.length3 || ''),
    chestWidth: String(s.chestWidth || ''),
    sleeveModel: String(s.sleeveModel || ''),
    buttonModel: String(s.buttonModel || ''),
    collarModel: String(s.collarModel || ''),
    customFields: custom,
  };
}

export type ExportProduct = {
  id: string;
  sku: string;
  slug?: string | null;
  name: string;
  nameEn?: string | null;
  status: string;
  description?: string | null;
  fabric?: string | null;
  specs?: ProductSpecs | null;
  sizeType?: string | null;
  categoryId?: string | null;
  category?: { id?: string; name?: string; slug?: string | null } | null;
  showOnWholesale?: boolean | null;
  showOnRetail?: boolean | null;
  wholesalePrice: number;
  retailPrice?: number | null;
  wholesaleCompareAtPrice?: number | null;
  retailCompareAtPrice?: number | null;
  wholesaleStock?: number | null;
  retailStock?: number | null;
  stock?: number | null;
  minOrderQty?: number | null;
  allowWholesaleColorSelect?: boolean | null;
  minWholesaleColors?: number | null;
  wholesaleIsDiscounted?: boolean | null;
  retailIsDiscounted?: boolean | null;
  wholesaleDiscountType?: string | null;
  retailDiscountType?: string | null;
  wholesaleDiscountPercent?: number | null;
  retailDiscountPercent?: number | null;
  wholesaleDiscountAmount?: number | null;
  retailDiscountAmount?: number | null;
  wholesaleDiscountStartsAt?: Date | string | null;
  retailDiscountStartsAt?: Date | string | null;
  wholesaleDiscountEndsAt?: Date | string | null;
  retailDiscountEndsAt?: Date | string | null;
  isDiscounted?: boolean | null;
  discountType?: string | null;
  discountPercent?: number | null;
  discountAmount?: number | null;
  discountStartsAt?: Date | string | null;
  discountEndsAt?: Date | string | null;
  retailFullContent?: string | null;
  wholesaleFullContent?: string | null;
  images?: string[] | null;
  seoMeta?: Record<string, string> | null;
  videoUrl?: string | null;
  modelInfo?: string | null;
  isPreOrder?: boolean | null;
  preOrderDate?: Date | string | null;
  viewCount?: number | null;
  faqItems?: Array<{ question?: string; answer?: string }> | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  variants?: Array<{
    id?: string;
    color?: string | null;
    colorHex?: string | null;
    size?: string | null;
    barcode?: string | null;
    imageUrl?: string | null;
    wholesaleStock?: number | null;
    retailStock?: number | null;
    stock?: number | null;
  }> | null;
  relatedSkus?: string[];
};

export type ExportCategory = {
  id: string;
  name: string;
  nameEn?: string | null;
  skuPrefix?: string | null;
  nextSequence?: number | null;
  slug?: string | null;
  status?: string | null;
  sortOrder?: number | null;
  isIndexable?: boolean | null;
  bannerUrl?: string | null;
  heroImage?: string | null;
  heroImageAlt?: string | null;
  ogImage?: string | null;
  canonicalOverride?: string | null;
  h1?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  introText?: string | null;
  bottomContent?: string | null;
  wholesaleH1?: string | null;
  wholesaleSeoTitle?: string | null;
  wholesaleSeoDescription?: string | null;
  wholesaleIntroText?: string | null;
  wholesaleBottomContent?: string | null;
  faqItems?: Array<{ question?: string; answer?: string }> | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  productCount?: number;
};

function matchesChannel(product: ExportProduct, channel: ExportChannel): boolean {
  if (channel === 'WHOLESALE') return product.showOnWholesale !== false;
  if (channel === 'RETAIL') return product.showOnRetail !== false;
  return true;
}

function productUrl(origin: string, slug?: string | null): string {
  const s = String(slug || '').replace(/^\/+|\/+$/g, '');
  return s ? `${origin}/products/${s}` : '';
}

function categoryUrl(origin: string, slug?: string | null): string {
  const s = String(slug || '').replace(/^\/+|\/+$/g, '');
  return s ? `${origin}/category/${s}` : '';
}

function productHeaders(): string[] {
  return [
    'شناسه',
    'SKU',
    'اسلاگ',
    'نام',
    'نام انگلیسی',
    'وضعیت',
    'دسته',
    'اسلاگ دسته',
    'نمایش در عمده',
    'نمایش در تکی',
    'لینک عمده',
    'لینک تکی',
    'قیمت نهایی عمده (تومان)',
    'قیمت قبل تخفیف عمده (تومان)',
    'تخفیف عمده فعال',
    'نوع تخفیف عمده',
    'درصد تخفیف عمده',
    'مبلغ تخفیف عمده (تومان)',
    'شروع تخفیف عمده',
    'پایان تخفیف عمده',
    'قیمت نهایی تکی (تومان)',
    'قیمت قبل تخفیف تکی (تومان)',
    'تخفیف تکی فعال',
    'نوع تخفیف تکی',
    'درصد تخفیف تکی',
    'مبلغ تخفیف تکی (تومان)',
    'شروع تخفیف تکی',
    'پایان تخفیف تکی',
    'موجودی عمده',
    'موجودی تکی',
    'حداقل پک',
    'تعداد در هر پک',
    'حداقل تعداد (عدد)',
    'انتخاب رنگ عمده',
    'حداقل رنگ عمده',
    'نوع سایز',
    'رنگ‌ها',
    'سایزها',
    'تعداد واریانت',
    'بارکدها',
    'جنس پارچه',
    'جزئیات طراحی',
    'مشخصات پکیج',
    'نشان تولید',
    'قد ۱',
    'قد ۲',
    'قد ۳',
    'عرض سینه',
    'مدل آستین',
    'مدل دکمه',
    'مدل یقه',
    'فیلدهای سفارشی',
    'توضیح کوتاه',
    'متن کامل عمده',
    'متن کامل تکی',
    'عنوان سئو عمده',
    'توضیح سئو عمده',
    'کلمه کلیدی عمده',
    'canonical عمده',
    'عنوان سئو تکی',
    'توضیح سئو تکی',
    'کلمه کلیدی تکی',
    'canonical تکی',
    'تصاویر',
    'ویدیو',
    'اطلاعات مدل',
    'پیش‌فروش',
    'تاریخ پیش‌فروش',
    'بازدید',
    'محصولات مرتبط (SKU)',
    'FAQ',
    'ایجاد',
    'به‌روزرسانی',
  ];
}

function productRow(p: ExportProduct): ExcelCell[] {
  const variants = p.variants || [];
  const colors = [...new Set(variants.map((v) => String(v.color || '').trim()).filter(Boolean))];
  const sizes = [...new Set(variants.map((v) => String(v.size || '').trim()).filter(Boolean))];
  const barcodes = [...new Set(variants.map((v) => String(v.barcode || '').trim()).filter(Boolean))];
  const packQty = computePackQty(colors, p.sizeType);
  const minPack = Math.max(1, Math.floor(Number(p.minOrderQty) || 1));
  const wholesaleSale = resolveChannelSale(p, 'WHOLESALE');
  const retailSale = resolveChannelSale(p, 'RETAIL');
  const seo = p.seoMeta || {};
  const spec = specsText(p.specs);
  const variantWholesale = variants.reduce(
    (s, v) => s + (Number(v.wholesaleStock) || 0),
    0,
  );
  const variantRetail = variants.reduce((s, v) => s + (Number(v.retailStock) || 0), 0);
  const wholesaleStock = variants.length
    ? variantWholesale
    : Number(p.wholesaleStock) || 0;
  const retailStock = variants.length ? variantRetail : Number(p.retailStock) || 0;

  return [
    p.id,
    p.sku,
    p.slug || '',
    p.name,
    p.nameEn || '',
    p.status,
    p.category?.name || '',
    p.category?.slug || '',
    yesNo(p.showOnWholesale !== false),
    yesNo(p.showOnRetail !== false),
    productUrl(WHOLESALE_ORIGIN, p.slug),
    productUrl(RETAIL_ORIGIN, p.slug),
    irrToToman(wholesaleSale.payable || p.wholesalePrice),
    irrToToman(wholesaleSale.original ?? p.wholesaleCompareAtPrice),
    yesNo(wholesaleSale.active),
    p.wholesaleDiscountType || p.discountType || '',
    p.wholesaleDiscountPercent ?? p.discountPercent ?? '',
    irrToToman(p.wholesaleDiscountAmount ?? p.discountAmount),
    formatTehran(p.wholesaleDiscountStartsAt ?? p.discountStartsAt),
    formatTehran(p.wholesaleDiscountEndsAt ?? p.discountEndsAt),
    irrToToman(retailSale.payable || p.retailPrice),
    irrToToman(retailSale.original ?? p.retailCompareAtPrice),
    yesNo(retailSale.active),
    p.retailDiscountType || '',
    p.retailDiscountPercent ?? '',
    irrToToman(p.retailDiscountAmount),
    formatTehran(p.retailDiscountStartsAt),
    formatTehran(p.retailDiscountEndsAt),
    wholesaleStock,
    retailStock,
    minPack,
    packQty,
    minOrderPieces(minPack, packQty),
    yesNo(p.allowWholesaleColorSelect),
    Math.max(1, Number(p.minWholesaleColors) || 1),
    p.sizeType || 'FREE',
    joinList(colors),
    joinList(sizes),
    variants.length,
    joinList(barcodes),
    spec.fabricType || p.fabric || '',
    spec.designDetails,
    spec.packageSpecs,
    spec.manufacturingBadge,
    spec.length,
    spec.length2,
    spec.length3,
    spec.chestWidth,
    spec.sleeveModel,
    spec.buttonModel,
    spec.collarModel,
    spec.customFields,
    p.description || '',
    p.wholesaleFullContent || '',
    p.retailFullContent || '',
    seo.wholesaleTitle || seo.title || '',
    seo.wholesaleDescription || seo.description || '',
    seo.wholesaleFocusKeyword || seo.focusKeyword || '',
    seo.wholesaleCanonical || seo.canonical || '',
    seo.retailTitle || '',
    seo.retailDescription || '',
    seo.retailFocusKeyword || '',
    seo.retailCanonical || '',
    joinList(p.images || []),
    p.videoUrl || '',
    p.modelInfo || '',
    yesNo(p.isPreOrder),
    formatTehran(p.preOrderDate),
    Number(p.viewCount) || 0,
    joinList(p.relatedSkus || [], ', '),
    faqText(p.faqItems),
    formatTehran(p.createdAt),
    formatTehran(p.updatedAt),
  ];
}

function variantRows(products: ExportProduct[]): ExcelCell[][] {
  const rows: ExcelCell[][] = [];
  for (const p of products) {
    for (const v of p.variants || []) {
      rows.push([
        p.sku,
        p.name,
        p.category?.name || '',
        v.color || '',
        v.colorHex || '',
        v.size || '',
        Number(v.wholesaleStock) || 0,
        Number(v.retailStock) || 0,
        v.barcode || '',
        v.imageUrl || '',
        productUrl(WHOLESALE_ORIGIN, p.slug),
        productUrl(RETAIL_ORIGIN, p.slug),
      ]);
    }
  }
  return rows;
}

function guideSheet(kind: 'products' | 'categories', channel: ExportChannel, count: number): ExcelSheet {
  return {
    name: 'راهنما',
    headers: ['موضوع', 'مقدار'],
    rows: [
      ['نوع خروجی', kind === 'products' ? 'محصولات' : 'دسته‌بندی‌ها'],
      ['کانال', channel === 'ALL' ? 'عمده و تکی' : channel === 'WHOLESALE' ? 'عمده' : 'تکی'],
      ['تعداد ردیف', count],
      ['واحد پول در ستون‌های قیمت', 'تومان (۱ تومان = ۱۰ ریال ذخیره‌شده در دیتابیس)'],
      ['لینک عمده', WHOLESALE_ORIGIN],
      ['لینک تکی', RETAIL_ORIGIN],
      ['منطقه زمانی تاریخ‌ها', 'Asia/Tehran'],
      ['بله / خیر', 'مقادیر منطقی فارسی'],
      ['قیمت نهایی', 'مبلغ قابل پرداخت فعلی همان کانال'],
      ['قیمت قبل تخفیف', 'فقط وقتی تخفیف همان کانال فعال است پر می‌شود'],
    ],
  };
}

export function buildProductWorkbook(input: {
  products: ExportProduct[];
  channel: ExportChannel;
}): { buffer: Buffer; filename: string } {
  const products = input.products.filter((p) => matchesChannel(p, input.channel));
  const sheets: ExcelSheet[] = [
    { name: 'محصولات', headers: productHeaders(), rows: products.map(productRow) },
    {
      name: 'واریانت‌ها',
      headers: [
        'SKU محصول',
        'نام محصول',
        'دسته',
        'رنگ',
        'کد رنگ',
        'سایز',
        'موجودی عمده',
        'موجودی تکی',
        'بارکد',
        'تصویر رنگ',
        'لینک عمده',
        'لینک تکی',
      ],
      rows: variantRows(products),
    },
    guideSheet('products', input.channel, products.length),
  ];
  const stamp = new Date().toISOString().slice(0, 10);
  const suffix =
    input.channel === 'ALL' ? 'all' : input.channel === 'WHOLESALE' ? 'wholesale' : 'retail';
  return {
    buffer: buildXlsx(sheets),
    filename: `taranom-products-${suffix}-${stamp}.xlsx`,
  };
}

function categoryHeaders(): string[] {
  return [
    'شناسه',
    'نام',
    'نام انگلیسی',
    'اسلاگ',
    'وضعیت',
    'ترتیب',
    'ایندکس‌پذیر',
    'پیشوند SKU',
    'شماره بعدی SKU',
    'تعداد محصول',
    'لینک عمده',
    'لینک تکی',
    'H1 تکی',
    'عنوان سئو تکی',
    'توضیح سئو تکی',
    'مقدمه تکی',
    'متن پایین تکی',
    'H1 عمده',
    'عنوان سئو عمده',
    'توضیح سئو عمده',
    'مقدمه عمده',
    'متن پایین عمده',
    'بنر ۱:۱',
    'تصویر هیرو',
    'alt هیرو',
    'og image',
    'canonical سفارشی',
    'FAQ',
    'ایجاد',
    'به‌روزرسانی',
  ];
}

function categoryRow(c: ExportCategory): ExcelCell[] {
  return [
    c.id,
    c.name,
    c.nameEn || '',
    c.slug || '',
    c.status || 'ACTIVE',
    Number(c.sortOrder) || 0,
    yesNo(c.isIndexable !== false),
    c.skuPrefix || '',
    Number(c.nextSequence) || 1,
    Number(c.productCount) || 0,
    categoryUrl(WHOLESALE_ORIGIN, c.slug),
    categoryUrl(RETAIL_ORIGIN, c.slug),
    c.h1 || '',
    c.seoTitle || '',
    c.seoDescription || '',
    c.introText || '',
    c.bottomContent || '',
    c.wholesaleH1 || '',
    c.wholesaleSeoTitle || '',
    c.wholesaleSeoDescription || '',
    c.wholesaleIntroText || '',
    c.wholesaleBottomContent || '',
    c.bannerUrl || '',
    c.heroImage || '',
    c.heroImageAlt || '',
    c.ogImage || '',
    c.canonicalOverride || '',
    faqText(c.faqItems),
    formatTehran(c.createdAt),
    formatTehran(c.updatedAt),
  ];
}

export function buildCategoryWorkbook(input: {
  categories: ExportCategory[];
  channel: ExportChannel;
}): { buffer: Buffer; filename: string } {
  const sheets: ExcelSheet[] = [
    { name: 'دسته‌بندی‌ها', headers: categoryHeaders(), rows: input.categories.map(categoryRow) },
    guideSheet('categories', input.channel, input.categories.length),
  ];
  const stamp = new Date().toISOString().slice(0, 10);
  const suffix =
    input.channel === 'ALL' ? 'all' : input.channel === 'WHOLESALE' ? 'wholesale' : 'retail';
  return {
    buffer: buildXlsx(sheets),
    filename: `taranom-categories-${suffix}-${stamp}.xlsx`,
  };
}
