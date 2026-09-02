'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { RetailProductCard } from './RetailProductCard';
import { trackViewItemList } from '@/lib/retail-analytics';

type Product = {
  id: string;
  name: string;
  slug: string;
  fabric?: string;
  retailPrice?: number | null;
  retailCompareAtPrice?: number | null;
  images?: string[];
  retailStock?: number;
  stock?: number;
  totalStock?: number;
  isNew?: boolean;
  isPreOrder?: boolean;
  variants?: Array<{ color: string; colorHex?: string; size: string; stock?: number; retailStock?: number }>;
  specs?: { collarModel?: string; fabricType?: string };
};

type Collection = { id: string; name: string; slug: string };

export type RetailCatalogSearchParams = {
  q?: string;
  search?: string;
  fabric?: string;
  color?: string;
  size?: string;
  collar?: string;
  collectionId?: string;
  category?: string;
  categoryId?: string;
  minPrice?: string;
  maxPrice?: string;
  page?: string;
  sort?: string;
};

function mediaUrl(url?: string) {
  if (!url) return undefined;
  if (url.startsWith('http') || url.startsWith('/')) return url;
  return `/media/${url}`;
}

function normalizeRetailProduct(raw: Record<string, unknown> | Product): Product {
  return {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? ''),
    slug: String(raw.slug ?? ''),
    fabric: typeof raw.fabric === 'string' ? raw.fabric : undefined,
    retailPrice:
      raw.retailPrice == null || raw.retailPrice === ''
        ? null
        : Number(raw.retailPrice),
    retailCompareAtPrice:
      raw.retailCompareAtPrice == null || raw.retailCompareAtPrice === ''
        ? null
        : Number(raw.retailCompareAtPrice),
    images: Array.isArray(raw.images) ? (raw.images as string[]) : [],
    retailStock: typeof raw.retailStock === 'number' ? raw.retailStock : undefined,
    isNew: Boolean(raw.isNew),
    isPreOrder: Boolean(raw.isPreOrder),
    variants: Array.isArray(raw.variants)
      ? (raw.variants as Array<{ color: string; colorHex?: string; size: string; stock?: number; retailStock?: number }>)
      : [],
    specs:
      raw.specs && typeof raw.specs === 'object'
        ? (raw.specs as Product['specs'])
        : undefined,
  };
}

const PAGE_SIZE = 24;

export function RetailProductsCatalog({
  initialProducts,
  initialTotalPages,
  initialPage = 1,
  seedDefaultListing = false,
  searchParams = {},
}: {
  initialProducts?: Array<Record<string, unknown> | Product>;
  initialTotalPages?: number;
  initialPage?: number;
  seedDefaultListing?: boolean;
  searchParams?: RetailCatalogSearchParams;
} = {}) {
  const seeded =
    seedDefaultListing && Array.isArray(initialProducts)
      ? initialProducts.map(normalizeRetailProduct)
      : null;
  const [products, setProducts] = useState<Product[]>(() => seeded ?? []);
  const [loading, setLoading] = useState(() => !seeded);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(() => (seeded ? Math.max(1, initialPage) : 1));
  const [totalPages, setTotalPages] = useState(() =>
    typeof initialTotalPages === 'number' && seeded ? initialTotalPages : 1,
  );
  const [fabric, setFabric] = useState(searchParams.fabric || '');
  const [color, setColor] = useState(searchParams.color || '');
  const [size, setSize] = useState(searchParams.size || '');
  const [collar, setCollar] = useState(searchParams.collar || '');
  const [collectionId, setCollectionId] = useState(searchParams.collectionId || '');
  const [categoryId, setCategoryId] = useState(
    searchParams.category || searchParams.categoryId || '',
  );
  const [minPrice, setMinPrice] = useState(searchParams.minPrice || '');
  const [maxPrice, setMaxPrice] = useState(searchParams.maxPrice || '');
  const [q, setQ] = useState(searchParams.q || searchParams.search || '');
  const [collections, setCollections] = useState<Collection[]>([]);
  const skipNextFetch = useRef(Boolean(seeded));

  useEffect(() => {
    apiClient
      .get<Collection[]>('/collections?active=1&channel=RETAIL')
      .then((rows) => setCollections(Array.isArray(rows) ? rows : []))
      .catch(() => setCollections([]));
  }, []);

  const buildParams = useCallback(
    (p: number) => {
      const params = new URLSearchParams({
        page: String(p),
        limit: String(PAGE_SIZE),
        status: 'ACTIVE',
        channel: 'RETAIL',
      });
      if (fabric) params.set('fabric', fabric);
      if (color) params.set('color', color);
      if (size) params.set('size', size);
      if (collar) params.set('collar', collar);
      if (collectionId) params.set('collectionId', collectionId);
      if (categoryId) params.set('categoryId', categoryId);
      if (minPrice) params.set('minPrice', String(Number(minPrice) * 10));
      if (maxPrice) params.set('maxPrice', String(Number(maxPrice) * 10));
      if (q.trim()) params.set('search', q.trim());
      return params;
    },
    [fabric, color, size, collar, collectionId, categoryId, minPrice, maxPrice, q],
  );

  useEffect(() => {
    if (skipNextFetch.current) {
      skipNextFetch.current = false;
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setPage(1);
      try {
        const data = await apiClient.get<{ data: Product[]; meta?: { totalPages?: number } }>(
          `/products?${buildParams(1)}`,
        );
        if (!cancelled) {
          setProducts(data.data ?? []);
          setTotalPages(data.meta?.totalPages || 1);
        }
      } catch {
        if (!cancelled) {
          setProducts([]);
          setTotalPages(1);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [buildParams]);

  useEffect(() => {
    if (loading || page !== 1 || products.length === 0) return;
    trackViewItemList(
      products.map((p) => ({
        productId: p.id,
        sku: p.id,
        name: p.name,
        unitPrice: Number(p.retailPrice ?? 0),
        quantity: 1,
        itemListId: 'retail_catalog',
        itemListName: 'Retail Catalog',
      })),
      'Retail Catalog',
      'retail_catalog',
    );
  }, [loading, page, products]);

  const loadMore = async () => {
    if (loadingMore || page >= totalPages) return;
    setLoadingMore(true);
    const next = page + 1;
    try {
      const data = await apiClient.get<{ data: Product[]; meta?: { totalPages?: number } }>(
        `/products?${buildParams(next)}`,
      );
      setProducts((prev) => [...prev, ...(data.data ?? [])]);
      setPage(next);
      setTotalPages(data.meta?.totalPages || totalPages);
    } catch {
      /* ignore */
    } finally {
      setLoadingMore(false);
    }
  };

  const fabrics = useMemo(() => {
    const set = new Set<string>(['لینن', 'کتان']);
    products.forEach((p) => {
      if (p.fabric) set.add(p.fabric);
      if (p.specs?.fabricType) set.add(p.specs.fabricType);
    });
    return [...set];
  }, [products]);

  const colors = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => (p.variants ?? []).forEach((v) => v.color && set.add(v.color)));
    return [...set];
  }, [products]);

  const garmentSizes = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => (p.variants ?? []).forEach((v) => v.size && set.add(v.size)));
    return [...set];
  }, [products]);

  return (
    <div className="pb-16">
      <div className="border-b border-[var(--retail-border)] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold text-[var(--retail-gold)]">فروشگاه</p>
          <h1 className="mt-1 text-3xl font-extrabold text-[var(--retail-ink)]">همه محصولات</h1>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input
              className="rounded-xl border border-[var(--retail-border)] px-3 py-2.5 text-sm"
              placeholder="جستجو…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select
              className="rounded-xl border border-[var(--retail-border)] px-3 py-2.5 text-sm"
              value={fabric}
              onChange={(e) => setFabric(e.target.value)}
            >
              <option value="">همه پارچه‌ها</option>
              {fabrics.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
            <select
              className="rounded-xl border border-[var(--retail-border)] px-3 py-2.5 text-sm"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            >
              <option value="">همه رنگ‌ها</option>
              {colors.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select
              className="rounded-xl border border-[var(--retail-border)] px-3 py-2.5 text-sm"
              value={size}
              onChange={(e) => setSize(e.target.value)}
            >
              <option value="">همه سایزها</option>
              <option value="FREE">فری‌سایز (نوع)</option>
              <option value="TWO">دو سایز (نوع)</option>
              <option value="THREE">سه سایز (نوع)</option>
              {garmentSizes.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <input
              className="rounded-xl border border-[var(--retail-border)] px-3 py-2.5 text-sm"
              placeholder="یقه (مثلاً ایستاده)"
              value={collar}
              onChange={(e) => setCollar(e.target.value)}
            />
            <select
              className="rounded-xl border border-[var(--retail-border)] px-3 py-2.5 text-sm"
              value={collectionId}
              onChange={(e) => setCollectionId(e.target.value)}
            >
              <option value="">همه کالکشن‌ها</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <input
              className="rounded-xl border border-[var(--retail-border)] px-3 py-2.5 text-sm"
              placeholder="حداقل قیمت (تومان)"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              inputMode="numeric"
            />
            <input
              className="rounded-xl border border-[var(--retail-border)] px-3 py-2.5 text-sm"
              placeholder="حداکثر قیمت (تومان)"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              inputMode="numeric"
            />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
        {loading ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-[var(--retail-bg)]" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <p className="py-16 text-center text-[var(--retail-muted)]">محصولی با این فیلتر پیدا نشد</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
              {products.map((p) => <RetailProductCard key={p.id} product={p} />)}
            </div>
            {totalPages > 1 ? (
              <nav
                aria-label="صفحه‌بندی محصولات"
                className="mt-10 flex flex-wrap items-center justify-center gap-3"
              >
                {page > 1 ? (
                  <Link
                    href={page === 2 ? '/products' : `/products?page=${page - 1}`}
                    className="inline-flex min-h-11 cursor-pointer items-center rounded-full border border-[var(--retail-primary)] px-5 text-sm font-bold text-[var(--retail-primary)]"
                  >
                    صفحه قبل
                  </Link>
                ) : null}
                {page < totalPages ? (
                  <>
                    <Link
                      href={`/products?page=${page + 1}`}
                      className="inline-flex min-h-11 cursor-pointer items-center rounded-full border border-[var(--retail-primary)] px-5 text-sm font-bold text-[var(--retail-primary)]"
                    >
                      صفحه بعد
                    </Link>
                    <button
                      type="button"
                      disabled={loadingMore}
                      onClick={loadMore}
                      className="cursor-pointer rounded-full px-4 py-3 text-sm font-bold text-[var(--retail-muted)] disabled:opacity-50"
                    >
                      {loadingMore ? 'در حال بارگذاری…' : 'بارگذاری بیشتر در همین صفحه'}
                    </button>
                  </>
                ) : null}
              </nav>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
