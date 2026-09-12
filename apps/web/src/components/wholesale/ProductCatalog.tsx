'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Search, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { Input, Button } from '@/components/ui';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/cn';
import { isLeadCatalogImage } from '@/lib/catalog-performance';
import { catalogActiveFilterCount, type CatalogFilterValues } from '@/lib/catalog-filter';
import { CatalogActiveChips } from '@/components/catalog/CatalogFilterRail';
import { CatalogFilters } from '@/components/catalog/CatalogFilters';
import { WholesaleProductCard } from './WholesaleProductCard';

export interface CatalogSearchParams {
  fabric?: string;
  color?: string;
  size?: string;
  sort?: string;
  page?: string;
  q?: string;
  inStock?: string;
}

interface Product {
  id: string;
  slug: string;
  sku: string;
  name: string;
  fabric: string;
  wholesalePrice: number;
  sale?: {
    active?: boolean;
    payable?: number;
    original?: number | null;
    badgePercent?: number;
  };
  status: string;
  stock?: number;
  wholesaleStock?: number;
  totalStock?: number;
  images: string[];
  sizeType?: string;
  minOrderQty?: number;
  variants: { id: string; color: string; colorHex?: string; stock: number; wholesaleStock?: number; size?: string }[];
}

function normalizeCatalogProduct(raw: Record<string, unknown> | Product): Product {
  const variants = Array.isArray(raw.variants) ? raw.variants : [];
  return {
    id: String(raw.id ?? ''),
    slug: String(raw.slug ?? ''),
    sku: String(raw.sku ?? ''),
    name: String(raw.name ?? ''),
    fabric: String(raw.fabric ?? ''),
    wholesalePrice: Number(raw.wholesalePrice ?? 0),
    sale: raw.sale && typeof raw.sale === 'object' ? (raw.sale as Product['sale']) : undefined,
    status: String(raw.status ?? 'ACTIVE'),
    wholesaleStock: typeof raw.wholesaleStock === 'number' ? raw.wholesaleStock : undefined,
    stock: typeof raw.wholesaleStock === 'number' ? raw.wholesaleStock : undefined,
    totalStock: typeof raw.wholesaleStock === 'number' ? raw.wholesaleStock : undefined,
    images: Array.isArray(raw.images) ? (raw.images as string[]) : [],
    sizeType: typeof raw.sizeType === 'string' ? raw.sizeType : undefined,
    minOrderQty: typeof raw.minOrderQty === 'number' ? raw.minOrderQty : undefined,
    variants: variants.map((v) => {
      const row = v as { id?: string; color?: string; colorHex?: string; stock?: number; wholesaleStock?: number; size?: string };
      const wholesale = Number(row.wholesaleStock ?? 0);
      return {
        id: String(row.id ?? ''),
        color: String(row.color ?? ''),
        colorHex: row.colorHex,
        wholesaleStock: wholesale,
        stock: wholesale,
        size: row.size,
      };
    }),
  };
}

const SORT_OPTIONS = [
  { value: 'newest', label: 'جدیدترین' },
  { value: 'popular', label: 'پرفروش‌ترین' },
  { value: 'price_asc', label: 'ارزان‌ترین' },
  { value: 'price_desc', label: 'گران‌ترین' },
];

function catalogTitle(filters: CatalogSearchParams): { h1: string; sub: string } {
  const parts: string[] = [];
  if (filters.fabric) parts.push(filters.fabric);
  if (filters.size === 'FREE') parts.push('فری‌سایز');
  if (filters.size === 'TWO') parts.push('دو سایز');
  if (filters.size === 'THREE') parts.push('سه سایز');
  if (filters.color) parts.push(filters.color);
  if (parts.length) {
    return {
      h1: `شومیزی زنانه ${parts.join(' ')} — خرید عمده`,
      sub: `فیلتر فعال: ${parts.join(' · ')} | تولیدی ترنم مشهد`,
    };
  }
  return {
    h1: 'کاتالوگ محصولات',
    sub: 'مانتو شومیزی زنانه — لینن و کتان، مستقیم از تولیدی',
  };
}

function SkeletonCard() {
  return (
    <div className="flex flex-col">
      <div className="aspect-[3/4] skeleton rounded-xl" />
      <div className="space-y-3 pt-3">
        <div className="skeleton h-4 w-3/4 rounded" />
        <div className="skeleton h-3 w-1/2 rounded" />
        <div className="skeleton mt-auto h-5 w-2/3 rounded" />
      </div>
    </div>
  );
}

export function ProductCatalog({
  searchParams,
  embedded = false,
  hideHeader = false,
  initialProducts,
  initialTotal,
}: {
  searchParams: CatalogSearchParams;
  embedded?: boolean;
  hideHeader?: boolean;
  /** SSR first page for clean listing — crawlers see product links in HTML */
  initialProducts?: Array<Record<string, unknown> | Product>;
  initialTotal?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const seeded = Array.isArray(initialProducts) ? initialProducts.map(normalizeCatalogProduct) : null;
  const [filters, setFilters] = useState<CatalogSearchParams>(searchParams ?? {});
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [sort, setSort] = useState(searchParams.sort ?? 'newest');
  const [search, setSearch] = useState(searchParams.q ?? '');
  const [products, setProducts] = useState<Product[]>(() => seeded ?? []);
  const [total, setTotal] = useState(() =>
    typeof initialTotal === 'number' ? initialTotal : seeded?.length ?? 0,
  );
  const [loading, setLoading] = useState(() => !seeded);
  const skipNextFetch = useRef(Boolean(seeded));

  const syncUrl = useCallback(
    (next: CatalogSearchParams, nextSort: string, nextQ: string) => {
      if (embedded || !pathname?.startsWith('/products')) return;
      const params = new URLSearchParams();
      if (next.fabric) params.set('fabric', next.fabric);
      if (next.color) params.set('color', next.color);
      if (next.size) params.set('size', next.size);
      if (next.inStock) params.set('inStock', next.inStock);
      if (nextSort && nextSort !== 'newest') params.set('sort', nextSort);
      if (nextQ) params.set('q', nextQ);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [embedded, pathname, router],
  );

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    params.set('limit', '24');
    params.set('channel', 'WHOLESALE');
    if (search) params.set('search', search);
    if (filters.fabric) params.set('fabric', filters.fabric);
    if (filters.color) params.set('color', filters.color);
    if (filters.size) params.set('size', filters.size);
    if (filters.inStock) params.set('inStock', filters.inStock);
    if (sort) params.set('sort', sort);
    return params.toString();
  }, [filters, sort, search]);

  useEffect(() => {
    if (skipNextFetch.current) {
      skipNextFetch.current = false;
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await apiClient.get<{ data: Product[]; meta: { total: number } }>(`/products?${buildQuery()}`);
        setProducts(res.data);
        setTotal(res.meta?.total ?? 0);
      } catch {
        setProducts([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [buildQuery]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const { h1 } = catalogTitle(filters);
    if (filters.fabric || filters.color || filters.size) {
      document.title = `${h1} | پوشاک ترنم`;
    }
  }, [filters]);

  const handleFilter = (key: keyof CatalogFilterValues, value: string) => {
    setFilters((p) => {
      const next = { ...p, [key]: value || undefined };
      syncUrl(next, sort, search);
      return next;
    });
  };
  const replaceFilters = (next: CatalogFilterValues) => {
    const clean: CatalogSearchParams = {
      fabric: next.fabric || undefined,
      color: next.color || undefined,
      size: next.size || undefined,
      inStock: next.inStock || undefined,
    };
    setFilters(clean);
    syncUrl(clean, sort, search);
  };
  const resetFilters = () => {
    setFilters({});
    syncUrl({}, sort, search);
  };
  const activeFilterCount = catalogActiveFilterCount(filters);
  const titles = catalogTitle(filters);

  return (
    <div className={cn(!embedded && 'min-h-screen bg-atmosphere')}>
      {!hideHeader && (
        <div className="border-b border-[color:var(--color-border)] bg-white">
          <div className="container-site py-8 sm:py-10">
            <nav className="mb-4 flex items-center gap-2 text-sm text-gray-500">
              <Link href="/" className="cursor-pointer transition-colors duration-200 hover:text-primary">خانه</Link>
              <span>/</span>
              <Link href="/products" className="cursor-pointer hover:text-primary">محصولات</Link>
              {filters.fabric && (
                <>
                  <span>/</span>
                  <span className="font-medium text-gray-900">{filters.fabric}</span>
                </>
              )}
            </nav>
            <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">{titles.h1}</h1>
            <p className="mt-2 text-sm text-gray-500">{titles.sub}</p>
          </div>
        </div>
      )}

      <div className={cn('container-site', embedded ? 'py-0' : 'py-8')}>
        <div className="mb-8 flex flex-wrap items-center gap-3">
          <div className="min-w-[200px] max-w-sm flex-1">
            <Input
              placeholder="جستجو در محصولات..."
              aria-label="جستجو در محصولات"
              value={search}
              onChange={(e) => {
                const v = e.target.value;
                setSearch(v);
                syncUrl(filters, sort, v);
              }}
              rightIcon={<Search className="h-4 w-4" />}
            />
          </div>
          <div className="mr-auto flex items-center gap-2">
            <div className="relative">
              <select
                value={sort}
                aria-label="مرتب‌سازی محصولات"
                onChange={(e) => {
                  setSort(e.target.value);
                  syncUrl(filters, e.target.value, search);
                }}
                className="input-base h-10 cursor-pointer appearance-none pl-8 pr-4 text-sm"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </div>
            <Button
              variant="outline"
              size="md"
              className="lg:hidden"
              aria-expanded={mobileFiltersOpen}
              aria-controls="catalog-filter-drawer"
              onClick={() => setMobileFiltersOpen(true)}
              rightIcon={<SlidersHorizontal className="h-4 w-4" />}
            >
              فیلتر {activeFilterCount > 0 && `(${activeFilterCount.toLocaleString('fa-IR')})`}
            </Button>
          </div>
        </div>

        <div className="flex gap-8">
          <CatalogFilters
            values={filters}
            onChange={handleFilter}
            onReplace={replaceFilters}
            onReset={resetFilters}
            tone="wholesale"
            mobileOpen={mobileFiltersOpen}
            onMobileOpenChange={setMobileFiltersOpen}
            extraColors={products.flatMap((p) => p.variants.map((v) => v.color).filter(Boolean))}
            extraFabrics={products.map((p) => p.fabric).filter(Boolean)}
            loading={loading}
          />

          <div className="min-w-0 flex-1">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-gray-500" aria-live="polite">
                {!loading && <span className="font-medium text-gray-900">{total.toLocaleString('fa-IR')}</span>}
                {loading ? 'در حال بارگذاری...' : ' مدل در این فهرست'}
              </p>
            </div>
            <CatalogActiveChips values={filters} onChange={handleFilter} onReset={resetFilters} />
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 xl:grid-cols-4">
              {loading
                ? Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)
                : products.length === 0
                  ? (
                    <div className="col-span-full rounded-2xl border border-dashed border-[color:var(--color-border)] py-16 text-center">
                      <p className="text-gray-700">با این ترکیب مدلی پیدا نشد.</p>
                      <p className="mt-1 text-sm text-gray-500">یک فیلتر را بردارید یا همه را پاک کنید.</p>
                      {activeFilterCount > 0 ? (
                        <button
                          type="button"
                          onClick={resetFilters}
                          className="mt-4 cursor-pointer text-sm font-bold text-primary"
                        >
                          پاک کردن فیلترها
                        </button>
                      ) : null}
                    </div>
                  )
                  : products.map((p, index) => (
                      <WholesaleProductCard
                        key={p.id}
                        product={p}
                        imagePriority={isLeadCatalogImage({
                          index,
                          embedded,
                          page: Math.max(1, Number(filters.page) || 1),
                        })}
                      />
                    ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
