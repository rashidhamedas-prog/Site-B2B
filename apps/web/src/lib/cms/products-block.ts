export const PRODUCTS_BLOCK_HOME_CAP = 12;
export const PRODUCTS_BLOCK_MAX_IDS = 16;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SKU_RE = /^[a-z0-9][a-z0-9_-]{0,46}\d[a-z0-9_-]{0,46}$/i;

export type ProductsBlockSource = 'auto' | 'manual';
export type ProductsBlockSort = 'newest' | 'views' | 'discounted';
export type ProductsBlockChannel = 'RETAIL' | 'WHOLESALE';

export type ProductsBlockQuery = {
  enabled: boolean;
  source: ProductsBlockSource;
  productIds: string[];
  sort: ProductsBlockSort;
  categoryId: string | null;
  limit: number;
  inStockOnly: boolean;
  eyebrow: string;
  headline: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  showPortalCta: boolean;
  portalBody: string;
  portalLoginLabel: string;
  portalRegisterLabel: string;
  portalLoginHref: string;
  portalRegisterHref: string;
  hideWhenEmpty: boolean;
};

export function parseProductIds(raw: unknown, max = PRODUCTS_BLOCK_MAX_IDS): string[] {
  const parts: string[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === 'string') parts.push(item);
      else if (item && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'string') {
        parts.push((item as { id: string }).id);
      }
    }
  } else if (typeof raw === 'string') {
    parts.push(...raw.split(/[,\s]+/));
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const token = part.trim();
    if (!token) continue;
    const isUuid = UUID_RE.test(token);
    const isSku = !isUuid && SKU_RE.test(token) && token.length <= 48;
    if (!isUuid && !isSku) continue;
    const id = isUuid ? token.toLowerCase() : token.toUpperCase();
    const key = id.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(id);
    if (out.length >= max) break;
  }
  return out;
}

export function serializeProductIds(ids: string[]): string {
  return parseProductIds(ids).join(',');
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function capProductsBlockLimit(limit: unknown, fallback = 12): number {
  const n = typeof limit === 'number' ? limit : Number(limit);
  const raw = Number.isFinite(n) ? Math.floor(n) : fallback;
  return Math.min(Math.max(1, raw), PRODUCTS_BLOCK_HOME_CAP);
}

export function resolveProductsBlockSort(
  raw: unknown,
  channel: ProductsBlockChannel,
): ProductsBlockSort {
  const sort = String(raw || '').toLowerCase();
  if (sort === 'views' || sort === 'newest' || sort === 'discounted') return sort;
  return channel === 'RETAIL' ? 'newest' : 'discounted';
}

export function resolveProductsBlockSource(
  props: Record<string, unknown>,
  ids: string[],
): ProductsBlockSource {
  const source = String(props.source || '').toLowerCase();
  if (source === 'manual' || source === 'auto') return source;
  return ids.length > 0 ? 'manual' : 'auto';
}

const DEFAULT_PORTAL_BODY =
  'برای مشاهده قیمت‌های عمده و ثبت سفارش آنلاین، ابتدا وارد پنل مشتری شوید';

export function normalizeProductsBlock(
  props: Record<string, unknown>,
  channel: ProductsBlockChannel,
): ProductsBlockQuery {
  const productIdsRaw = parseProductIds(props.productIds ?? props.products);
  const source = resolveProductsBlockSource(props, productIdsRaw);
  const productIds = source === 'manual' ? productIdsRaw : [];
  const fallbackLimit = channel === 'WHOLESALE' ? 6 : 12;
  const ctaLabel =
    asString(props.viewAllLabel).trim() ||
    asString(props.ctaLabel).trim() ||
    'مشاهده همه محصولات';
  const ctaHref = asString(props.ctaHref).trim() || '/products';
  return {
    enabled: asBool(props.enabled, true),
    source,
    productIds,
    sort: resolveProductsBlockSort(props.sort, channel),
    categoryId: asString(props.categoryId).trim() || null,
    limit: capProductsBlockLimit(props.limit, fallbackLimit),
    inStockOnly: asBool(props.inStockOnly, false),
    eyebrow: asString(props.eyebrow).trim(),
    headline: asString(props.headline).trim(),
    body: asString(props.body).trim(),
    ctaLabel,
    ctaHref,
    showPortalCta: asBool(props.showPortalCta, channel === 'WHOLESALE'),
    portalBody: asString(props.portalBody).trim() || DEFAULT_PORTAL_BODY,
    portalLoginLabel: asString(props.portalLoginLabel).trim() || 'ورود به پنل',
    portalRegisterLabel: asString(props.portalRegisterLabel).trim() || 'ثبت‌نام عمده‌فروش',
    portalLoginHref: asString(props.portalLoginHref).trim() || '/portal/login',
    portalRegisterHref: asString(props.portalRegisterHref).trim() || '/portal/register',
    hideWhenEmpty: asBool(props.hideWhenEmpty, channel === 'WHOLESALE'),
  };
}

export function productsBlockCatalogParams(query: ProductsBlockQuery): {
  ids?: string[];
  sort: ProductsBlockSort;
  categoryId?: string;
  limit: number;
  inStockOnly: boolean;
} {
  if (query.source === 'manual' && query.productIds.length) {
    return {
      ids: query.productIds.slice(0, query.limit),
      sort: query.sort,
      limit: query.limit,
      inStockOnly: query.inStockOnly,
    };
  }
  return {
    sort: query.sort,
    categoryId: query.categoryId || undefined,
    limit: query.limit,
    inStockOnly: query.inStockOnly,
  };
}

/**
 * Persist-ready props: auto mode must not keep curated ids, otherwise a missing
 * `source` (or admin inference) snaps the block back to manual after reload.
 */
export function productsBlockPropsForSave(
  props: Record<string, unknown>,
  channel: ProductsBlockChannel,
): Record<string, unknown> {
  const query = normalizeProductsBlock(props, channel);
  // Drop legacy `products` array so reload cannot re-infer manual from leftovers.
  const { products: _legacyProducts, ...rest } = props;
  return {
    ...rest,
    enabled: query.enabled,
    source: query.source,
    productIds: query.source === 'manual' ? serializeProductIds(query.productIds) : '',
    sort: query.sort,
    categoryId: query.categoryId || '',
    limit: query.limit,
    inStockOnly: query.inStockOnly,
    eyebrow: query.eyebrow,
    headline: query.headline,
    body: query.body,
    ctaLabel: query.ctaLabel,
    viewAllLabel: query.ctaLabel,
    ctaHref: query.ctaHref,
    showPortalCta: query.showPortalCta,
    portalBody: query.portalBody,
    portalLoginLabel: query.portalLoginLabel,
    portalRegisterLabel: query.portalRegisterLabel,
    portalLoginHref: query.portalLoginHref,
    portalRegisterHref: query.portalRegisterHref,
    hideWhenEmpty: query.hideWhenEmpty,
  };
}

/** True when prepared auto mode would be shown as manual after a stale reload. */
export function productsBlockSaveRegressed(
  prepared: Record<string, unknown> | undefined,
  verified: Record<string, unknown> | undefined,
  channel: ProductsBlockChannel,
): boolean {
  if (!prepared || !verified) return false;
  const want = normalizeProductsBlock(prepared, channel);
  const got = normalizeProductsBlock(verified, channel);
  if (want.source !== 'auto') return false;
  return got.source !== 'auto' || got.productIds.length > 0;
}
