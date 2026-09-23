const FORBIDDEN_CLAIM = /پرفروش|موجودی\s*محدود|بهترین|تضمین|بدون\s*رقیب|شگفت.?انگیز|ارزان.?ترین|پرطرفدارترین/;

export type StockBand = 'in_stock' | 'low' | 'out_of_stock';

export function stockBand(retailStock: number): StockBand {
  const n = Number(retailStock);
  if (!Number.isFinite(n) || n <= 0) return 'out_of_stock';
  if (n <= 2) return 'low';
  return 'in_stock';
}

export function humanStockBand(band: StockBand): string {
  if (band === 'out_of_stock') return 'فعلاً ناموجود';
  if (band === 'low') return 'موجودی کم';
  return 'موجود';
}

export function isFactualCaption(text: string): boolean {
  return !FORBIDDEN_CLAIM.test(text);
}

export function factualFacts(input: {
  fabricType?: string | null;
  color?: string | null;
  sizeType?: string | null;
}): string[] {
  const facts: string[] = [];
  if (input.fabricType?.trim()) facts.push(`جنس: ${input.fabricType.trim()}`);
  if (input.color?.trim()) facts.push(`رنگ: ${input.color.trim()}`);
  if (input.sizeType === 'FREE') facts.push('سایز: فری‌سایز');
  else if (input.sizeType === 'TWO') facts.push('سایز: دو سایز');
  else if (input.sizeType === 'THREE') facts.push('سایز: سه سایز');
  return facts;
}

export function partnerCopyText(input: {
  name: string;
  facts: string[];
  priceTomanLabel: string;
  productUrl: string;
}): string {
  const lines = [
    input.name.trim(),
    ...input.facts,
    `قیمت فعلی فروشگاه تکی: ${input.priceTomanLabel}`,
    'قیمت و موجودی هنگام ثبت سفارش از سرور خوانده می‌شود.',
    input.productUrl,
  ].filter(Boolean);
  const text = lines.join('\n');
  return isFactualCaption(text) ? text : [input.name.trim(), 'قیمت هنگام ثبت سفارش از سرور خوانده می‌شود.', input.productUrl].join('\n');
}

export function shortPartnerBlurb(raw: string | null | undefined): string | null {
  const text = String(raw ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  if (!isFactualCaption(text)) return null;
  return text.slice(0, 180);
}
