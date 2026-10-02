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

const CATALOG_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PartnerCatalogSort = 'category' | 'price_asc' | 'price_desc' | 'commission';
export type PartnerCatalogStock = 'all' | 'available' | 'out';
export type AdminCatalogEligible = 'all' | 'yes' | 'no';

export type PartnerCatalogQuery = {
  page?: number;
  q?: string;
  categoryId?: string;
  stock?: string;
  sort?: string;
  pageSize?: number;
};

export type ParsedPartnerCatalogQuery = {
  page: number;
  pageSize: number;
  q: string;
  categoryId: string;
  stock: PartnerCatalogStock;
  sort: PartnerCatalogSort;
};

export type CatalogListCard = {
  name: string;
  categoryId: string | null;
  categoryName: string;
  priceIrr: number;
  stockBand: StockBand;
  estimatedCommissionIrr: number;
};

function cleanQuery(raw: string | undefined, max = 60): string {
  return String(raw || '').replace(/[%_\\]/g, '').trim().slice(0, max);
}

export function parsePartnerCatalogQuery(input: PartnerCatalogQuery = {}): ParsedPartnerCatalogQuery {
  const page = Math.max(1, Math.min(50, Math.trunc(Number(input.page) || 1)));
  const pageSize = Math.max(1, Math.min(48, Math.trunc(Number(input.pageSize) || 24)));
  const stock: PartnerCatalogStock = input.stock === 'available' || input.stock === 'out' ? input.stock : 'all';
  const sort: PartnerCatalogSort =
    input.sort === 'price_asc' || input.sort === 'price_desc' || input.sort === 'commission' ? input.sort : 'category';
  const categoryId = CATALOG_UUID.test(String(input.categoryId || '')) ? String(input.categoryId) : '';
  return { page, pageSize, q: cleanQuery(input.q), categoryId, stock, sort };
}

export function parseAdminCatalogQuery(input: {
  q?: string;
  page?: number;
  categoryId?: string;
  eligible?: string;
} = {}) {
  const page = Math.max(1, Math.min(50, Math.trunc(Number(input.page) || 1)));
  const eligible: AdminCatalogEligible = input.eligible === 'yes' || input.eligible === 'no' ? input.eligible : 'all';
  const categoryId = CATALOG_UUID.test(String(input.categoryId || '')) ? String(input.categoryId) : '';
  return { page, q: cleanQuery(input.q), categoryId, eligible };
}

function matchesText(item: CatalogListCard, q: string): boolean {
  if (!q) return true;
  const hay = `${item.name} ${item.categoryName}`.toLocaleLowerCase('fa');
  return hay.includes(q.toLocaleLowerCase('fa'));
}

function matchesStock(item: CatalogListCard, stock: PartnerCatalogStock): boolean {
  if (stock === 'available') return item.stockBand !== 'out_of_stock';
  if (stock === 'out') return item.stockBand === 'out_of_stock';
  return true;
}

function compareCards(a: CatalogListCard, b: CatalogListCard, sort: PartnerCatalogSort): number {
  const byName = a.name.localeCompare(b.name, 'fa');
  if (sort === 'price_asc') return a.priceIrr - b.priceIrr || byName;
  if (sort === 'price_desc') return b.priceIrr - a.priceIrr || byName;
  if (sort === 'commission') return b.estimatedCommissionIrr - a.estimatedCommissionIrr || byName;
  return a.categoryName.localeCompare(b.categoryName, 'fa') || byName;
}

export function preparePartnerCatalog<T extends CatalogListCard>(items: T[], raw: PartnerCatalogQuery = {}) {
  const query = parsePartnerCatalogQuery(raw);
  const searched = items.filter((item) => matchesText(item, query.q));
  const forCategories = searched.filter((item) => matchesStock(item, query.stock));
  const forStock = query.categoryId
    ? searched.filter((item) => item.categoryId === query.categoryId)
    : searched;
  const selected = query.categoryId
    ? forCategories.filter((item) => item.categoryId === query.categoryId)
    : forCategories;
  const counts = new Map<string, { id: string | null; name: string; count: number }>();
  for (const item of forCategories) {
    const key = item.categoryId || 'none';
    const row = counts.get(key) || { id: item.categoryId, name: item.categoryName || 'بدون دسته', count: 0 };
    row.count += 1;
    counts.set(key, row);
  }
  const sorted = [...selected].sort((a, b) => compareCards(a, b, query.sort));
  const start = (query.page - 1) * query.pageSize;
  return {
    items: sorted.slice(start, start + query.pageSize),
    page: query.page,
    pageSize: query.pageSize,
    total: sorted.length,
    sort: query.sort,
    facets: {
      categories: [...counts.values()].sort((a, b) => a.name.localeCompare(b.name, 'fa')),
      stock: {
        all: forStock.length,
        available: forStock.filter((item) => item.stockBand !== 'out_of_stock').length,
        out: forStock.filter((item) => item.stockBand === 'out_of_stock').length,
      },
    },
  };
}

export function shortPartnerBlurb(raw: string | null | undefined): string | null {
  const text = String(raw ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  if (!isFactualCaption(text)) return null;
  return text.slice(0, 180);
}
