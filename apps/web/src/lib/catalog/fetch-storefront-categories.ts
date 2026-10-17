import { cache } from 'react';
import { getServerApiBase } from '@/lib/server-api-base';
import { catalogFetchInit } from './category-storefront';

export type StorefrontCategoryRow = {
  id: string;
  name?: string | null;
  nameEn?: string | null;
  slug?: string | null;
  bannerUrl?: string | null;
  showOnHome?: boolean | null;
};

/** Public ACTIVE categories. Deduped per request; ISR tag `catalog` (60s). */
export const fetchStorefrontCategories = cache(async function fetchStorefrontCategories(): Promise<
  StorefrontCategoryRow[]
> {
  try {
    const res = await fetch(`${getServerApiBase()}/categories`, catalogFetchInit());
    if (!res.ok) return [];
    const all = (await res.json()) as StorefrontCategoryRow[] | { data?: StorefrontCategoryRow[] };
    if (Array.isArray(all)) return all;
    return Array.isArray(all?.data) ? all.data : [];
  } catch {
    return [];
  }
});
