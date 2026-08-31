'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { apiClient } from '@/lib/api';
import {
  buildCategoryProductsQuery,
  categorySearchParamsFromURL,
  hasCategoryFilters,
  normalizeCategoryProducts,
  type CategoryChannel,
  type CategoryProduct,
  type CategoryProductListResult,
} from './category-search-params';

const CategoryProductListing = dynamic(() =>
  import('./CategoryProductListing').then((mod) => mod.CategoryProductListing),
);

export function CategoryQueryOverlay({
  channel,
  slug,
}: {
  channel: CategoryChannel;
  slug: string;
}) {
  const [queryKey, setQueryKey] = useState('');
  useEffect(() => {
    const sync = () => setQueryKey(window.location.search.replace(/^\?/, ''));
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);
  const params = useMemo(
    () => categorySearchParamsFromURL(new URLSearchParams(queryKey)),
    [queryKey],
  );
  const filtered = hasCategoryFilters(params);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [listing, setListing] = useState<CategoryProductListResult | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  useEffect(() => {
    setTarget(document.getElementById('category-listing-query'));
    const staticListing = document.getElementById('category-listing-static');
    if (!staticListing) return;
    staticListing.hidden = filtered;
    return () => {
      staticListing.hidden = false;
    };
  }, [filtered]);

  useEffect(() => {
    if (!filtered) {
      setListing(null);
      setStatus('idle');
      return;
    }
    let cancelled = false;
    setStatus('loading');
    apiClient
      .get<{ data?: CategoryProduct[]; meta?: CategoryProductListResult['meta'] } | CategoryProduct[]>(
        `/products?${buildCategoryProductsQuery(channel, slug, params)}`,
      )
      .then((json) => {
        if (cancelled) return;
        setListing(normalizeCategoryProducts(json, params));
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [filtered, channel, slug, queryKey, params]);

  if (!filtered) return null;

  const body = (
    <>
      <meta name="robots" content="noindex, follow" />
      {status === 'ready' && listing ? (
        <CategoryProductListing
          channel={channel}
          slug={slug}
          listing={listing}
          searchParams={params}
        />
      ) : (
        <p className="mt-10 text-sm text-[var(--brand-muted,#6B7280)]" aria-live="polite">
          {status === 'error' ? 'بارگذاری فیلتر ناموفق بود.' : 'در حال بارگذاری محصولات…'}
        </p>
      )}
    </>
  );

  if (!target) return <meta name="robots" content="noindex, follow" />;
  return createPortal(body, target);
}
