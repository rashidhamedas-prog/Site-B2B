export type CategoryChannel = 'RETAIL' | 'WHOLESALE';

export type CategorySearchParams = {
  q?: string;
  search?: string;
  fabric?: string;
  color?: string;
  size?: string;
  collar?: string;
  collectionId?: string;
  minPrice?: string;
  maxPrice?: string;
  page?: string;
  sort?: string;
};

export const CATEGORY_FILTER_KEYS: Array<keyof CategorySearchParams> = [
  'q',
  'search',
  'fabric',
  'color',
  'size',
  'collar',
  'collectionId',
  'minPrice',
  'maxPrice',
  'page',
  'sort',
];

export function hasCategoryFilters(params: CategorySearchParams): boolean {
  return CATEGORY_FILTER_KEYS.some((key) => Boolean(params[key]));
}

export function categorySearchParamsFromURL(
  searchParams: Pick<URLSearchParams, 'get'>,
): CategorySearchParams {
  const params: CategorySearchParams = {};
  for (const key of CATEGORY_FILTER_KEYS) {
    const value = searchParams.get(key);
    if (value) params[key] = value;
  }
  return params;
}

export function categoryPageQuery(params: CategorySearchParams, page?: number): string {
  const qs = new URLSearchParams();
  for (const key of CATEGORY_FILTER_KEYS) {
    if (key === 'page') continue;
    const value = params[key];
    if (value) qs.set(key, value);
  }
  if (page && page > 1) qs.set('page', String(page));
  const raw = qs.toString();
  return raw ? `?${raw}` : '';
}

export function buildCategoryProductsQuery(
  channel: CategoryChannel,
  slug: string,
  params: CategorySearchParams,
): string {
  const page = Math.max(1, Number(params.page) || 1);
  const qs = new URLSearchParams({
    channel,
    categorySlug: slug,
    limit: '24',
    page: String(page),
    status: 'ACTIVE',
  });
  if (params.q || params.search) qs.set('q', String(params.q || params.search));
  if (params.fabric) qs.set('fabric', params.fabric);
  if (params.color) qs.set('color', params.color);
  if (params.size) qs.set('size', params.size);
  if (params.collar) qs.set('collar', params.collar);
  if (params.collectionId) qs.set('collectionId', params.collectionId);
  if (params.minPrice) qs.set('minPrice', params.minPrice);
  if (params.maxPrice) qs.set('maxPrice', params.maxPrice);
  if (params.sort) qs.set('sort', params.sort);
  if (channel === 'WHOLESALE') qs.set('includeVariants', '1');
  return qs.toString();
}

export type CategoryProduct = {
  id?: string;
  name?: string;
  slug?: string;
  fabric?: string;
  retailPrice?: number | null;
  wholesalePrice?: number | null;
  sale?: {
    active?: boolean;
    payable?: number;
    original?: number | null;
    badgePercent?: number;
  };
  images?: string[];
  variants?: Array<{ color?: string; colorHex?: string; size?: string }>;
};

export type CategoryProductListResult = {
  data: CategoryProduct[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

export function normalizeCategoryProducts(
  json: { data?: CategoryProduct[]; meta?: CategoryProductListResult['meta'] } | CategoryProduct[],
  params: CategorySearchParams,
): CategoryProductListResult {
  const page = Math.max(1, Number(params.page) || 1);
  const limit = 24;
  if (Array.isArray(json)) {
    return { data: json, meta: { page, limit, total: json.length, totalPages: 1 } };
  }
  const data = Array.isArray(json.data) ? json.data : [];
  return {
    data,
    meta: {
      page: json.meta?.page ?? page,
      limit: json.meta?.limit ?? limit,
      total: json.meta?.total ?? data.length,
      totalPages: json.meta?.totalPages ?? 1,
    },
  };
}
