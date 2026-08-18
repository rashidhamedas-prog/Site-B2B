export type ContentChannel = 'RETAIL' | 'WHOLESALE';

export interface ProductContentInput {
  name: string;
  description?: string | null;
  retailFullContent?: string | null;
  wholesaleFullContent?: string | null;
  legacyContent?: string | null;
  fabric?: string | null;
  specs?: {
    fabricType?: string | null;
    designDetails?: string | null;
    packageSpecs?: string | null;
    manufacturingBadge?: string | null;
    packQty?: string | null;
    length?: string | null;
    sleeveModel?: string | null;
    collarModel?: string | null;
    buttonModel?: string | null;
    customFields?: Array<{ label?: string; value?: string }>;
  } | null;
  sizeType?: string | null;
  colors?: string[];
  sizes?: string[];
  packQty?: number | null;
  minPackQty?: number | null;
  careInstructions?: Record<string, unknown> | null;
  categoryName?: string | null;
}

const MAX_CHARS = 8000;

function clean(value: unknown): string {
  return String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function paragraph(text: string): string {
  const t = clean(text);
  return t ? `${t}\n\n` : '';
}

function listJoin(items: string[]): string {
  return items.map(clean).filter(Boolean).join('، ');
}

function sizesLabel(sizeType?: string | null, sizes?: string[]): string {
  if (sizes && sizes.length) return listJoin(sizes);
  const t = String(sizeType || '').toUpperCase();
  if (t === 'TWO') return 'دو سایز';
  if (t === 'THREE') return 'سه سایز';
  if (t === 'FREE') return 'فری‌سایز';
  return '';
}

function careLines(care?: Record<string, unknown> | null): string[] {
  if (!care || typeof care !== 'object') return [];
  const out: string[] = [];
  for (const [key, value] of Object.entries(care)) {
    const v = clean(value);
    if (!v) continue;
    const label = clean(key);
    out.push(label ? `${label}: ${v}` : v);
  }
  return out;
}

function specExtras(specs?: ProductContentInput['specs']): string[] {
  if (!specs) return [];
  const rows: Array<[string, unknown]> = [
    ['قد', specs.length],
    ['مدل آستین', specs.sleeveModel],
    ['مدل یقه', specs.collarModel],
    ['مدل دکمه', specs.buttonModel],
    ['مشخصات پکیج', specs.packageSpecs],
    ['جزئیات طراحی', specs.designDetails],
  ];
  const out: string[] = [];
  for (const [label, value] of rows) {
    const v = clean(value);
    if (v) out.push(`${label}: ${v}`);
  }
  for (const field of specs.customFields ?? []) {
    const label = clean(field.label);
    const value = clean(field.value);
    if (label && value) out.push(`${label}: ${value}`);
  }
  return out;
}

export function isLegacyCopiedContent(
  field: string | null | undefined,
  description: string | null | undefined,
): boolean {
  const a = clean(field);
  const b = clean(description);
  if (!a) return true;
  if (!b) return false;
  return a === b;
}

export function shouldFillChannelContent(
  input: ProductContentInput,
  channel: ContentChannel,
  mode: 'empty' | 'legacy-equal' | 'force',
): boolean {
  const field = channel === 'RETAIL' ? input.retailFullContent : input.wholesaleFullContent;
  if (mode === 'force') return true;
  if (mode === 'empty') return !clean(field);
  return isLegacyCopiedContent(field, input.description) || isLegacyCopiedContent(field, input.legacyContent);
}

export function generateRetailProductContent(input: ProductContentInput): string {
  const name = clean(input.name);
  const fabric = clean(input.specs?.fabricType) || clean(input.fabric);
  const colors = listJoin(input.colors ?? []);
  const sizing = sizesLabel(input.sizeType, input.sizes);
  const extras = specExtras(input.specs);
  const care = careLines(input.careInstructions);
  const category = clean(input.categoryName);

  let body = '';
  if (name) {
    body += paragraph(
      category
        ? `${name} از مجموعه ${category} برای استفاده روزمره و استایل شخصی طراحی شده است.`
        : `${name} برای استفاده روزمره و استایل شخصی طراحی شده است.`,
    );
  }
  if (fabric) {
    body += paragraph(`جنس این محصول ${fabric} است و ویژگی‌های ذکرشده فقط بر اساس داده ثبت‌شده محصول است.`);
  }
  if (sizing || colors) {
    const bits: string[] = [];
    if (sizing) bits.push(`سایزبندی: ${sizing}`);
    if (colors) bits.push(`رنگ‌بندی: ${colors}`);
    body += paragraph(bits.join('. ') + '.');
  }
  if (extras.length) {
    body += paragraph(`جزئیات ثبت‌شده محصول: ${extras.join('؛ ')}.`);
  }
  if (care.length) {
    body += paragraph(`نکات نگهداری: ${care.join('؛ ')}.`);
  } else {
    body += paragraph('برای نگهداری، از دستور مراقبت ثبت‌شده روی برچسب محصول پیروی کنید.');
  }
  if (sizing || colors) {
    body += paragraph(
      'برای استایل، رنگ و سایز ثبت‌شده را با سایر آیتم‌های موجود در کمد هماهنگ کنید؛ ادعای دیگری به محصول اضافه نشده است.',
    );
  }
  return body.trim().slice(0, MAX_CHARS);
}

export function generateWholesaleProductContent(input: ProductContentInput): string {
  const name = clean(input.name);
  const fabric = clean(input.specs?.fabricType) || clean(input.fabric);
  const colors = listJoin(input.colors ?? []);
  const sizing = sizesLabel(input.sizeType, input.sizes);
  const category = clean(input.categoryName);
  const packQty = Number(input.packQty);
  const minPack = Number(input.minPackQty);
  const extras = specExtras(input.specs);
  const badge = clean(input.specs?.manufacturingBadge);

  let body = '';
  if (name) {
    body += paragraph(
      category ? `${name} در دسته ${category} برای سفارش عمده فروشگاهی عرضه می‌شود.` : `${name} برای سفارش عمده فروشگاهی عرضه می‌شود.`,
    );
  }
  if (fabric) body += paragraph(`جنس ثبت‌شده: ${fabric}.`);
  if (colors) body += paragraph(`رنگ‌های موجود در پک: ${colors}.`);
  if (sizing) body += paragraph(`سایزبندی پک: ${sizing}.`);
  if (Number.isFinite(packQty) && packQty > 0) {
    body += paragraph(`تعداد هر پک ${packQty} عدد است (رنگ‌های متمایز × سایزهای معتبر).`);
  }
  if (Number.isFinite(minPack) && minPack > 0) {
    const total = Number.isFinite(packQty) && packQty > 0 ? minPack * packQty : null;
    body += paragraph(
      total
        ? `حداقل سفارش ${minPack} پک است؛ مجموع حداقل سفارش ${total} عدد.`
        : `حداقل سفارش ${minPack} پک است.`,
    );
  }
  if (extras.length) body += paragraph(`اطلاعات تولید و بسته‌بندی ثبت‌شده: ${extras.join('؛ ')}.`);
  if (badge) body += paragraph(`نشان تولید ثبت‌شده: ${badge}.`);
  return body.trim().slice(0, MAX_CHARS);
}

export function generateChannelContent(input: ProductContentInput, channel: ContentChannel): string {
  return channel === 'RETAIL' ? generateRetailProductContent(input) : generateWholesaleProductContent(input);
}
