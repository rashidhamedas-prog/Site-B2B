function irrToTomanOnce(irr: number): number {
  return Math.max(0, Math.round(Number(irr || 0) / 10));
}

/** Official OpenAPI (https://developers.basalam.com/docs/quick-start). Do not invent hosts. */
export const BASALAM_OPENAPI_BASE = 'https://openapi.basalam.com/v1';

/** ProductStatusInputEnum.UNPUBLISHED — stall draft until the vendor publishes. */
export const BASALAM_STATUS_UNPUBLISHED = 3790;

export const DEFAULT_WEIGHT_G = 400;
export const DEFAULT_PACKAGE_WEIGHT_G = 500;
export const DEFAULT_PREP_DAYS = 3;

export type StallProduct = {
  id: number;
  title: string;
  sku: string | null;
  categoryId: number | null;
};

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

export function normalizeDigits(text: string): string {
  return String(text || '').replace(/[۰-۹٠-٩]/g, (ch) => {
    const fa = FA_DIGITS.indexOf(ch);
    if (fa >= 0) return String(fa);
    const ar = AR_DIGITS.indexOf(ch);
    return ar >= 0 ? String(ar) : ch;
  });
}

export function extractStyleCodes(text: string): string[] {
  const found = normalizeDigits(text).match(/\d{4,6}/g) || [];
  return [...new Set(found)];
}

export function coreTitle(text: string): string {
  return normalizeDigits(text)
    .replace(/کد\s*\d{3,6}/gi, ' ')
    .replace(/لینن|کتان|نخی|کرپ|ریون|ساتن|مخمل/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function uniqueById(rows: StallProduct[]): StallProduct[] {
  const seen = new Set<number>();
  const out: StallProduct[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}

export function matchStallProduct(
  local: { id: string; sku?: string | null; name: string },
  stall: StallProduct[],
  existingMap: Record<string, number>,
): number | null {
  const mapped = Number(existingMap[local.id]);
  if (mapped > 0) return mapped;

  const sku = String(local.sku || '').trim();
  if (sku) {
    const bySku = stall.filter((item) => String(item.sku || '').trim() === sku);
    if (bySku.length === 1) return bySku[0].id;
  }

  const localCodes = extractStyleCodes(`${local.name} ${sku}`);
  if (localCodes.length) {
    const byCode = uniqueById(
      stall.filter((item) => {
        const codes = extractStyleCodes(`${item.title} ${item.sku || ''}`);
        return localCodes.some((code) => codes.includes(code));
      }),
    );
    if (byCode.length === 1) return byCode[0].id;
  }

  const localCore = coreTitle(local.name);
  if (localCore.length >= 8) {
    const byTitle = uniqueById(stall.filter((item) => coreTitle(item.title) === localCore));
    if (byTitle.length === 1) return byTitle[0].id;
  }
  return null;
}

export function stripHtml(text: string): string {
  return String(text || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function absMediaUrl(url: string | undefined | null, origin: string): string {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url.replace(/^http:\/\//i, 'https://');
  const base = origin.replace(/\/$/, '');
  if (url.startsWith('/')) return `${base}${url}`;
  return `${base}/media/${url}`;
}

export function pickPhotoUrls(images: string[] | null | undefined, origin: string, max = 5): string[] {
  const out: string[] = [];
  for (const image of images || []) {
    const abs = absMediaUrl(image, origin);
    if (abs.startsWith('https://')) out.push(abs);
    if (out.length >= max) break;
  }
  return out;
}

export function parseStallList(json: unknown): StallProduct[] {
  const root = json && typeof json === 'object' ? (json as Record<string, unknown>) : {};
  const rows = Array.isArray(root.data) ? root.data : Array.isArray(json) ? json : [];
  return rows
    .map((row) => {
      const item = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
      const category =
        item.category && typeof item.category === 'object'
          ? (item.category as Record<string, unknown>)
          : {};
      return {
        id: Number(item.id),
        title: String(item.title || item.name || ''),
        sku: item.sku ? String(item.sku) : null,
        categoryId: Number(category.id || item.category_id) || null,
      };
    })
    .filter((row) => row.id > 0);
}

export function pickCategoryId(stall: StallProduct[], fallback?: number | null): number | null {
  const counts = new Map<number, number>();
  for (const item of stall) {
    if (item.categoryId && item.categoryId > 0) {
      counts.set(item.categoryId, (counts.get(item.categoryId) || 0) + 1);
    }
  }
  let best = fallback && fallback > 0 ? fallback : null;
  let n = 0;
  for (const [id, count] of counts) {
    if (count > n) {
      n = count;
      best = id;
    }
  }
  return best;
}

export function flattenCategories(json: unknown): Array<{ id: number; title: string }> {
  const bag: Array<{ id: number; title: string }> = [];
  const walk = (node: unknown) => {
    if (!node) return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node !== 'object') return;
    const item = node as Record<string, unknown>;
    const id = Number(item.id);
    const title = String(item.title || item.name || '');
    if (id > 0 && title) bag.push({ id, title });
    walk(item.children);
    walk(item.data);
    walk(item.categories);
  };
  walk(json);
  const seen = new Set<number>();
  return bag.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

export function pickClothingCategoryId(categories: Array<{ id: number; title: string }>): number | null {
  const prefer = categories.find((row) => /مانتو|شومیز|پوشاک زنانه|لباس زنانه/.test(row.title));
  if (prefer) return prefer.id;
  const clothing = categories.find((row) => /پوشاک|لباس/.test(row.title));
  return clothing?.id ?? null;
}

export function createdProductId(json: unknown): number | null {
  const root = json && typeof json === 'object' ? (json as Record<string, unknown>) : {};
  const nested = root.data && typeof root.data === 'object' ? (root.data as Record<string, unknown>) : {};
  const product = root.product && typeof root.product === 'object' ? (root.product as Record<string, unknown>) : {};
  const id = Number(root.id ?? nested.id ?? product.id);
  return id > 0 ? id : null;
}

/** Official create body: https://developers.basalam.com/docs/quick-start */
export function buildCreatePayload(input: {
  name: string;
  sku?: string | null;
  description?: string | null;
  priceIrr: number;
  stock: number;
  photoIds: number[];
  categoryId: number;
}): Record<string, unknown> {
  const photos = input.photoIds.filter((id) => Number.isFinite(id) && id > 0);
  const brief = stripHtml(input.name).slice(0, 200);
  const description = stripHtml(input.description || '').slice(0, 5000) || brief;
  const payload: Record<string, unknown> = {
    name: String(input.name || '').slice(0, 200),
    brief,
    description,
    preparation_days: DEFAULT_PREP_DAYS,
    weight: DEFAULT_WEIGHT_G,
    package_weight: DEFAULT_PACKAGE_WEIGHT_G,
    primary_price: irrToTomanOnce(input.priceIrr),
    stock: Math.max(0, Math.floor(Number(input.stock) || 0)),
    is_wholesale: false,
    status: BASALAM_STATUS_UNPUBLISHED,
    category_id: input.categoryId,
  };
  const sku = String(input.sku || '').trim().slice(0, 64);
  if (sku) payload.sku = sku;
  if (photos.length === 1) {
    payload.photo = photos[0];
  } else if (photos.length > 1) {
    payload.photo = photos[0];
    payload.photos = photos.slice(1);
  }
  return payload;
}
