'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronDown, Search, SlidersHorizontal } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { RetailProductCard } from './RetailProductCard';
import { trackViewItemList } from '@/lib/retail-analytics';
import { isLeadCatalogImage } from '@/lib/catalog-performance';
import { catalogActiveFilterCount, type CatalogFilterValues } from '@/lib/catalog-filter';
import { CatalogActiveChips } from '@/components/catalog/CatalogFilterRail';
import { CatalogFilters } from '@/components/catalog/CatalogFilters';

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
  inStock?: string;
};

function filtersFromSearch(searchParams: RetailCatalogSearchParams): CatalogFilterValues {
  return {
    fabric: searchParams.fabric || undefined,
    color: searchParams.color || undefined,
    size: searchParams.size || undefined,
    collar: searchParams.collar || undefined,
    collectionId: searchParams.collectionId || undefined,
    minPrice: searchParams.minPrice || undefined,
    maxPrice: searchParams.maxPrice || undefined,
    inStock: searchParams.inStock || undefined,
  };
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
const SORT_OPTIONS = [
  { value: 'newest', label: 'جدیدترین' },
  { value: 'popular', label: 'پرفروش‌ترین' },
  { value: 'price_asc', label: 'ارزان‌ترین' },
  { value: 'price_desc', label: 'گران‌ترین' },
];

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
  const router = useRouter();
  const pathname = usePathname();
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
  const [total, setTotal] = useState(() => seeded?.length ?? 0);
  const [filters, setFilters] = useState<CatalogFilterValues>(() => filtersFromSearch(searchParams));
  const [categoryId] = useState(searchParams.category || searchParams.categoryId || '');
  const [q, setQ] = useState(searchParams.q || searchParams.search || '');
  const [sort, setSort] = useState(searchParams.sort || 'newest');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const skipNextFetch = useRef(Boolean(seeded));

  const syncUrl = useCallback(
    (next: CatalogFilterValues, nextSort: string, nextQ: string) => {
      if (!pathname || !/\/products\/?$/.test(pathname)) return;
      const params = new URLSearchParams();
      if (next.fabric) params.set('fabric', next.fabric);
      if (next.color) params.set('color', next.color);
      if (next.size) params.set('size', next.size);
      if (next.collar) params.set('collar', next.collar);
      if (next.collectionId) params.set('collectionId', next.collectionId);
      if (next.minPrice) params.set('minPrice', next.minPrice);
      if (next.maxPrice) params.set('maxPrice', next.maxPrice);
      if (next.inStock) params.set('inStock', next.inStock);
      if (nextSort && nextSort !== 'newest') params.set('sort', nextSort);
      if (nextQ) params.set('q', nextQ);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

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
      if (filters.fabric) params.set('fabric', filters.fabric);
      if (filters.color) params.set('color', filters.color);
      if (filters.size) params.set('size', filters.size);
      if (filters.collar) params.set('collar', filters.collar);
      if (filters.collectionId) params.set('collectionId', filters.collectionId);
      if (categoryId) params.set('categoryId', categoryId);
      if (filters.minPrice) params.set('minPrice', String(Number(filters.minPrice) * 10));
      if (filters.maxPrice) params.set('maxPrice', String(Number(filters.maxPrice) * 10));
      if (filters.inStock) params.set('inStock', filters.inStock);
      if (sort && sort !== 'newest') params.set('sort', sort);
      if (q.trim()) params.set('search', q.trim());
      return params;
    },
    [filters, categoryId, q, sort],
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
        const data = await apiClient.get<{
          data: Product[];
          meta?: { totalPages?: number; total?: number };
        }>(`/products?${buildParams(1)}`);
        if (!cancelled) {
          setProducts(data.data ?? []);
          setTotalPages(data.meta?.totalPages || 1);
          setTotal(data.meta?.total ?? data.data?.length ?? 0);
        }
      } catch {
        if (!cancelled) {
          setProducts([]);
          setTotalPages(1);
          setTotal(0);
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
      const data = await apiClient.get<{ data: Product[]; meta?: { totalPages?: number; total?: number } }>(
        `/products?${buildParams(next)}`,
      );
      setProducts((prev) => [...prev, ...(data.data ?? [])]);
      setPage(next);
      setTotalPages(data.meta?.totalPages || totalPages);
      if (typeof data.meta?.total === 'number') setTotal(data.meta.total);
    } catch {
      /* ignore */
    } finally {
      setLoadingMore(false);
    }
  };

  const extraFabrics = useMemo(() => {
    const extras: string[] = [];
    products.forEach((p) => {
      if (p.fabric) extras.push(p.fabric);
      if (p.specs?.fabricType) extras.push(p.specs.fabricType);
    });
    return extras;
  }, [products]);

  const extraColors = useMemo(() => {
    const extras: string[] = [];
    products.forEach((p) => (p.variants ?? []).forEach((v) => v.color && extras.push(v.color)));
    return extras;
  }, [products]);

  const garmentSizes = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) =>
      (p.variants ?? []).forEach((v) => {
        if (v.size && !['FREE', 'TWO', 'THREE'].includes(v.size)) set.add(v.size);
      }),
    );
    return [...set];
  }, [products]);

  const handleFilter = (key: keyof CatalogFilterValues, value: string) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value || undefined };
      syncUrl(next, sort, q);
      return next;
    });
  };
  const replaceFilters = (next: CatalogFilterValues) => {
    setFilters(next);
    syncUrl(next, sort, q);
  };
  const resetFilters = () => {
    setFilters({});
    syncUrl({}, sort, q);
  };

  const activeFilterCount = catalogActiveFilterCount(filters);
  const selectedCollection = collections.find((c) => c.id === filters.collectionId);

  return (
    <div className="pb-16">
      <div className="border-b border-[var(--retail-border)] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold text-[var(--retail-gold)]">فروشگاه</p>
          <h1 className="mt-1 text-3xl font-extrabold text-[var(--retail-ink)]">همه محصولات</h1>
          <p className="mt-2 max-w-xl text-sm text-[var(--retail-muted)]">
            پارچه، رنگ و سایز را مشخص کنید تا مدل مناسب خودتان در فهرست بماند.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <label className="relative min-w-[200px] max-w-sm flex-1">
              <span className="sr-only">جستجو در محصولات</span>
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--retail-muted)]" />
              <input
                className="h-11 w-full rounded-xl border border-[var(--retail-border)] bg-white py-2.5 pr-10 pl-3 text-sm text-[var(--retail-ink)]"
                placeholder="جستجو در محصولات…"
                value={q}
                onChange={(e) => {
                  const v = e.target.value;
                  setQ(v);
                  syncUrl(filters, sort, v);
                }}
              />
            </label>
            <div className="mr-auto flex items-center gap-2">
              <div className="relative">
                <select
                  value={sort}
                  aria-label="مرتب‌سازی محصولات"
                  onChange={(e) => {
                    setSort(e.target.value);
                    syncUrl(filters, e.target.value, q);
                  }}
                  className="h-11 cursor-pointer appearance-none rounded-xl border border-[var(--retail-border)] bg-white py-2 pl-8 pr-4 text-sm text-[var(--retail-ink)]"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--retail-muted)]" />
              </div>
              <button
                type="button"
                className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-[var(--retail-border)] px-4 text-sm font-bold text-[var(--retail-ink)] lg:hidden"
                aria-expanded={mobileFiltersOpen}
                aria-controls="catalog-filter-drawer"
                onClick={() => setMobileFiltersOpen(true)}
              >
                <SlidersHorizontal className="h-4 w-4" />
                فیلتر {activeFilterCount > 0 ? `(${activeFilterCount.toLocaleString('fa-IR')})` : ''}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
        <div className="flex gap-8">
          <CatalogFilters
            values={filters}
            onChange={handleFilter}
            onReplace={replaceFilters}
            onReset={resetFilters}
            tone="retail"
            mobileOpen={mobileFiltersOpen}
            onMobileOpenChange={setMobileFiltersOpen}
            extraFabrics={extraFabrics}
            extraColors={extraColors}
            garmentSizes={garmentSizes}
            collections={collections}
            showPrice
            showCollar
            showCollections
            loading={loading}
          />

          <div className="min-w-0 flex-1">
            <p className="mb-4 text-sm text-[var(--retail-muted)]" aria-live="polite">
              {!loading && <span className="font-medium text-[var(--retail-ink)]">{total.toLocaleString('fa-IR')}</span>}
              {loading ? 'در حال بارگذاری...' : ' مدل در این فهرست'}
            </p>
            <CatalogActiveChips
              values={filters}
              onChange={handleFilter}
              onReset={resetFilters}
              collectionName={selectedCollection?.name}
            />
            {loading ? (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 xl:grid-cols-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-[var(--retail-bg)]" />
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--retail-border)] py-16 text-center">
                <p className="text-[var(--retail-ink)]">با این ترکیب مدلی پیدا نشد.</p>
                <p className="mt-1 text-sm text-[var(--retail-muted)]">یک فیلتر را بردارید یا همه را پاک کنید.</p>
                {activeFilterCount > 0 ? (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="mt-4 cursor-pointer text-sm font-bold text-[var(--retail-primary)]"
                  >
                    پاک کردن فیلترها
                  </button>
                ) : null}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 xl:grid-cols-3">
                  {products.map((p, index) => (
                    <RetailProductCard
                      key={p.id}
                      product={p}
                      imagePriority={isLeadCatalogImage({ index, page })}
                    />
                  ))}
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
      </div>
    </div>
  );
}
