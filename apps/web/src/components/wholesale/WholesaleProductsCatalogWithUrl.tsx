'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { ProductCatalog, type CatalogSearchParams } from './ProductCatalog';

function paramsFromSearch(search: string): CatalogSearchParams {
  const usp = new URLSearchParams(search.replace(/^\?/, ''));
  const next: CatalogSearchParams = {};
  const keys: Array<keyof CatalogSearchParams> = ['q', 'fabric', 'color', 'size', 'sort', 'page'];
  for (const key of keys) {
    const value = usp.get(key);
    if (value) next[key] = value;
  }
  return next;
}

function hasCatalogFilters(params: CatalogSearchParams): boolean {
  return Boolean(
    params.q ||
      params.fabric ||
      params.color ||
      params.size ||
      (params.sort && params.sort !== 'newest') ||
      (params.page && Number(params.page) > 1),
  );
}

export function WholesaleProductsCatalogWithUrl({
  initialProducts,
  initialTotal,
}: {
  initialProducts?: Array<Record<string, unknown>>;
  initialTotal?: number;
}) {
  const router = useRouter();
  const [params, setParams] = useState<CatalogSearchParams>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const next = paramsFromSearch(window.location.search);
    setParams(next);
    setHydrated(true);
    const categoryId = new URLSearchParams(window.location.search).get('categoryId');
    if (!categoryId) return;
    let cancelled = false;
    apiClient
      .get<Array<{ id?: string; slug?: string }> | { data?: Array<{ id?: string; slug?: string }> }>(
        '/categories?channel=WHOLESALE',
      )
      .then((json) => {
        if (cancelled) return;
        const rows = Array.isArray(json) ? json : json.data ?? [];
        const match = rows.find((row) => row.id === categoryId && row.slug);
        if (!match?.slug) return;
        const qs = new URLSearchParams(window.location.search);
        qs.delete('categoryId');
        const suffix = qs.toString();
        router.replace(`/category/${match.slug}${suffix ? `?${suffix}` : ''}`);
      })
      .catch(() => {
        /* keep the listing if lookup fails */
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  const filtered = useMemo(() => hasCatalogFilters(params), [params]);

  return (
    <>
      {hydrated && filtered ? <meta name="robots" content="noindex, follow" /> : null}
      <ProductCatalog
        key={hydrated ? JSON.stringify(params) : 'ssr-default'}
        searchParams={params}
        initialProducts={filtered ? undefined : initialProducts}
        initialTotal={filtered ? undefined : initialTotal}
      />
    </>
  );
}
