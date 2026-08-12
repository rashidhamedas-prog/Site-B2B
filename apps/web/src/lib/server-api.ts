/**
 * Server-only API base for RSC / route handlers.
 * Prefer docker-internal URL so SSR does not depend on public DNS/loopback.
 */
export function getServerApiBase(): string {
  const raw =
    process.env.API_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:4000/v1';
  const base = String(raw).replace(/\/$/, '');
  return base.endsWith('/v1') ? base : `${base}/v1`;
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
