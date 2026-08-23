import { cache } from 'react';
import { getServerApiBase } from '@/lib/server-api-base';

export { getServerApiBase } from '@/lib/server-api-base';

/** Public settings (no user/session). Deduped per request via React cache() + Next fetch memo. */
export const fetchPublicSettings = cache(async function fetchPublicSettings<T = Record<string, unknown>>(
  channel: 'RETAIL' | 'WHOLESALE',
): Promise<T | null> {
  try {
    const base = getServerApiBase();
    const res = await fetch(`${base}/settings/public?channel=${channel}`, {
      next: { revalidate: 120 },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
});

/** Strip catalog SSR payload to card fields so RSC HTML stays small. */
export function slimRetailCatalogProduct(raw: Record<string, unknown>): Record<string, unknown> {
  const images = Array.isArray(raw.images) ? (raw.images as unknown[]).filter((u) => typeof u === 'string').slice(0, 2) : [];
  const variants = Array.isArray(raw.variants)
    ? (raw.variants as Array<Record<string, unknown>>).map((v) => ({
        id: v.id,
        color: v.color,
        colorHex: v.colorHex,
        size: v.size,
        stock: v.stock ?? v.retailStock,
        retailStock: v.retailStock ?? v.stock,
      }))
    : [];
  const specs =
    raw.specs && typeof raw.specs === 'object'
      ? {
          collarModel: (raw.specs as Record<string, unknown>).collarModel,
          fabricType: (raw.specs as Record<string, unknown>).fabricType,
        }
      : undefined;
  return {
    id: raw.id,
    name: raw.name,
    slug: raw.slug,
    sku: raw.sku,
    fabric: raw.fabric,
    retailPrice: raw.retailPrice,
    retailCompareAtPrice: raw.retailCompareAtPrice,
    images,
    stock: raw.stock,
    totalStock: raw.totalStock,
    isNew: raw.isNew,
    isPreOrder: raw.isPreOrder,
    sale: raw.sale,
    variants,
    specs,
  };
}

export type ProductListMeta = {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
};

export type ProductListResult<T = Record<string, unknown>> = {
  data: T[];
  meta: ProductListMeta;
};

/** First-page storefront catalog for RSC (ISR). Keep limit modest for TTFB. */
export async function fetchProductList<T = Record<string, unknown>>(options: {
  channel: 'RETAIL' | 'WHOLESALE';
  limit?: number;
  page?: number;
  status?: string;
  sort?: string;
}): Promise<ProductListResult<T>> {
  const limit = Math.min(Math.max(1, options.limit ?? 24), 48);
  const page = Math.max(1, options.page ?? 1);
  const empty: ProductListResult<T> = {
    data: [],
    meta: { page, limit, total: 0, totalPages: 1 },
  };
  try {
    const base = getServerApiBase();
    const params = new URLSearchParams({
      channel: options.channel,
      limit: String(limit),
      page: String(page),
      status: options.status ?? 'ACTIVE',
    });
    if (options.sort) params.set('sort', options.sort);
    const res = await fetch(`${base}/products?${params}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return empty;
    const json = (await res.json()) as { data?: T[]; meta?: ProductListMeta } | T[];
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
  } catch {
    return empty;
  }
}

export async function fetchProductBySlug(
  slug: string,
  channel?: 'RETAIL' | 'WHOLESALE',
): Promise<Record<string, unknown> | null> {
  const base = getServerApiBase();
  const candidates = Array.from(
    new Set([
      slug,
      (() => {
        try {
          return decodeURIComponent(slug);
        } catch {
          return slug;
        }
      })(),
    ]),
  );

  for (const candidate of candidates) {
    try {
      const qs = channel ? `?channel=${channel}` : '';
      const res = await fetch(
        `${base}/products/slug/${encodeURIComponent(candidate)}${qs}`,
        { cache: 'no-store' },
      );
      if (!res.ok) continue;
      return (await res.json()) as Record<string, unknown>;
    } catch {
      /* try next */
    }
  }
  return null;
}
