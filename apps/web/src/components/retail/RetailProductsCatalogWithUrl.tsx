'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import {
  RetailProductsCatalog,
  type RetailCatalogSearchParams,
} from './RetailProductsCatalog';

function paramsFromSearch(search: string): RetailCatalogSearchParams {
  const usp = new URLSearchParams(search.replace(/^\?/, ''));
  const next: RetailCatalogSearchParams = {};
  const keys: Array<keyof RetailCatalogSearchParams> = [
    'q',
    'search',
    'fabric',
    'color',
    'size',
    'collar',
    'collectionId',
    'category',
    'categoryId',
    'minPrice',
    'maxPrice',
    'page',
    'sort',
  ];
  for (const key of keys) {
    const value = usp.get(key);
    if (value) next[key] = value;
  }
  return next;
}

function hasCatalogFilters(params: RetailCatalogSearchParams): boolean {
  return Boolean(
    params.q ||
      params.search ||
      params.fabric ||
      params.color ||
      params.size ||
      params.collar ||
      params.collectionId ||
      params.category ||
      params.categoryId ||
      params.minPrice ||
      params.maxPrice ||
      params.sort ||
      (params.page && Number(params.page) > 1),
  );
}

export function RetailProductsCatalogWithUrl({
  initialProducts,
  initialTotalPages,
}: {
  initialProducts?: Array<Record<string, unknown>>;
  initialTotalPages?: number;
}) {
  const router = useRouter();
  const [params, setParams] = useState<RetailCatalogSearchParams>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const next = paramsFromSearch(window.location.search);
    setParams(next);
    setHydrated(true);
    const categoryId = next.categoryId;
    if (!categoryId) return;
    let cancelled = false;
    apiClient
      .get<Array<{ id?: string; slug?: string }> | { data?: Array<{ id?: string; slug?: string }> }>(
        '/categories',
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
        /* keep the filtered catalog if the category lookup fails */
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  const filtered = useMemo(() => hasCatalogFilters(params), [params]);

  return (
    <>
      {hydrated && filtered ? <meta name="robots" content="noindex, follow" /> : null}
      <RetailProductsCatalog
        key={hydrated ? JSON.stringify(params) : 'ssr-default'}
        searchParams={params}
        initialProducts={initialProducts}
        initialTotalPages={initialTotalPages}
        initialPage={1}
        seedDefaultListing={!filtered}
      />
    </>
  );
}
