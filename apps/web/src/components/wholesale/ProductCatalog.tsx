'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ProductImage } from '@/components/ui/ProductImage';
import { Search, SlidersHorizontal, X, ChevronDown } from 'lucide-react';
import { Input, Button, Badge } from '@/components/ui';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/cn';

export interface CatalogSearchParams {
  fabric?: string;
  color?: string;
  size?: string;
  sort?: string;
  page?: string;
  q?: string;
}

interface Product {
  id: string;
  slug: string;
  sku: string;
  name: string;
  fabric: string;
  wholesalePrice: number;
  status: string;
  stock?: number;
  totalStock?: number;
  images: string[];
  sizeType?: string;
  variants: { id: string; color: string; colorHex?: string; stock: number }[];
}

const FABRICS = ['همه', 'لینن', 'کتان', 'مازاراتی', 'شال', 'مموری', 'پشمی', 'فوتر', 'لینن‌کتان', 'ویسکوز'];
const SIZES = [
  { value: '', label: 'همه' },
  { value: 'FREE', label: 'فری‌سایز' },
  { value: 'TWO', label: 'دو سایز' },
  { value: 'THREE', label: 'سه سایز' },
];
const COLORS = ['بژ', 'سرمه‌ای', 'مشکی', 'سفید', 'کرم', 'خاکستری', 'قهوه‌ای', 'زیتونی'];
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

function FilterPanel({
  activeFilters,
  onFilter,
  onReset,
}: {
  activeFilters: CatalogSearchParams;
  onFilter: (key: string, value: string) => void;
  onReset: () => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h4 className="mb-3 text-sm font-semibold text-gray-900">نوع پارچه</h4>
        <div className="flex flex-wrap gap-2">
          {FABRICS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => onFilter('fabric', f === 'همه' ? '' : f)}
              className={cn(
                'cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                activeFilters.fabric === f || (f === 'همه' && !activeFilters.fabric)
                  ? 'border-primary bg-primary text-white'
                  : 'border-gray-200 text-gray-600 hover:border-primary hover:text-primary',
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h4 className="mb-3 text-sm font-semibold text-gray-900">سایزبندی</h4>
        <div className="flex flex-wrap gap-2">
          {SIZES.map((s) => (
            <button
              key={s.value || 'all'}
              type="button"
              onClick={() => onFilter('size', s.value)}
              className={cn(
                'cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                (activeFilters.size || '') === s.value
                  ? 'border-primary bg-primary text-white'
                  : 'border-gray-200 text-gray-600 hover:border-primary hover:text-primary',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h4 className="mb-3 text-sm font-semibold text-gray-900">رنگ</h4>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onFilter('color', activeFilters.color === c ? '' : c)}
              className={cn(
                'cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                activeFilters.color === c
                  ? 'border-primary bg-primary text-white'
                  : 'border-gray-200 text-gray-600 hover:border-primary hover:text-primary',
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <Button variant="ghost" size="sm" fullWidth onClick={onReset} className="text-gray-500">
        پاک کردن فیلترها
      </Button>
    </div>
  );
}

function ProductCard({ product }: { product: Product }) {
  const colorCount = [...new Set(product.variants.map((v) => v.color))].length;
  const stock =
    typeof product.stock === 'number'
      ? product.stock
      : typeof product.totalStock === 'number'
        ? product.totalStock
        : product.variants.reduce((s, v) => s + (Number(v.stock) || 0), 0);
  const inStock = stock > 0 || product.status === 'COMING_SOON';
  return (
    <Link href={`/products/${product.slug}`} className="product-tile group">
      <div className="product-tile-media">
        <ProductImage
          src={product.images?.[0]}
          alt={product.name}
          sizes="(max-width:640px) 50vw, (max-width:1024px) 33vw, 25vw"
        />
        {!inStock && (
          <div className="absolute top-3 right-3">
            <span className="rounded bg-gray-600 px-2 py-0.5 text-[10px] font-bold text-white">ناموجود</span>
          </div>
        )}
        <div className="absolute inset-0 bg-primary/0 transition-colors duration-250 group-hover:bg-primary/5" />
      </div>
      <div className="flex flex-1 flex-col gap-2 pt-3">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-gray-800">{product.name}</h3>
        <div className="flex items-center gap-2">
          {product.fabric && <Badge variant="neutral">{product.fabric}</Badge>}
          {colorCount > 0 && <span className="text-xs text-gray-400">{colorCount} رنگ</span>}
        </div>
        <div className="mt-auto flex items-end justify-between pt-1">
          <span className="text-xs text-gray-400">قیمت عمده</span>
          <p className="text-base font-bold text-primary">
            {Math.round(Number(product.wholesalePrice) / 10).toLocaleString('fa-IR')} تومان
          </p>
        </div>
      </div>
    </Link>
  );
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
}: {
  searchParams: CatalogSearchParams;
  embedded?: boolean;
  hideHeader?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [filters, setFilters] = useState<CatalogSearchParams>(searchParams ?? {});
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [sort, setSort] = useState(searchParams.sort ?? 'newest');
  const [search, setSearch] = useState(searchParams.q ?? '');
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const syncUrl = useCallback(
    (next: CatalogSearchParams, nextSort: string, nextQ: string) => {
      if (embedded || !pathname?.startsWith('/products')) return;
      const params = new URLSearchParams();
      if (next.fabric) params.set('fabric', next.fabric);
      if (next.color) params.set('color', next.color);
      if (next.size) params.set('size', next.size);
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
    if (search) params.set('search', search);
    if (filters.fabric) params.set('fabric', filters.fabric);
    if (filters.color) params.set('color', filters.color);
    if (filters.size) params.set('size', filters.size);
    if (sort) params.set('sort', sort);
    return params.toString();
  }, [filters, sort, search]);

  useEffect(() => {
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

  const handleFilter = (key: string, value: string) => {
    setFilters((p) => {
      const next = { ...p, [key]: value || undefined };
      syncUrl(next, sort, search);
      return next;
    });
  };
  const resetFilters = () => {
    setFilters({});
    syncUrl({}, sort, search);
  };
  const activeFilterCount = [filters.fabric, filters.color, filters.size].filter(Boolean).length;
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
              onClick={() => setMobileFiltersOpen(true)}
              rightIcon={<SlidersHorizontal className="h-4 w-4" />}
            >
              فیلتر {activeFilterCount > 0 && `(${activeFilterCount})`}
            </Button>
          </div>
        </div>

        <div className="flex gap-8">
          <aside className="hidden w-60 flex-shrink-0 lg:block">
            <div className="glass-card sticky top-28 p-5">
              <h3 className="mb-5 text-sm font-bold text-gray-900">فیلترها</h3>
              <FilterPanel activeFilters={filters} onFilter={handleFilter} onReset={resetFilters} />
            </div>
          </aside>

          {mobileFiltersOpen && (
            <>
              <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileFiltersOpen(false)} />
              <aside className="fixed inset-y-0 right-0 z-50 w-80 overflow-y-auto glass-strong shadow-xl lg:hidden">
                <div className="p-5">
                  <div className="mb-6 flex items-center justify-between">
                    <h3 className="font-bold text-gray-900">فیلترها</h3>
                    <button
                      type="button"
                      onClick={() => setMobileFiltersOpen(false)}
                      className="cursor-pointer rounded-lg p-1 transition-colors duration-200 hover:bg-gray-100"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <FilterPanel activeFilters={filters} onFilter={handleFilter} onReset={resetFilters} />
                </div>
              </aside>
            </>
          )}

          <div className="min-w-0 flex-1">
            <p className="mb-5 text-sm text-gray-500">
              {!loading && <span className="font-medium text-gray-900">{total.toLocaleString('fa-IR')}</span>}
              {loading ? 'در حال بارگذاری...' : ' محصول یافت شد'}
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 xl:grid-cols-4">
              {loading
                ? Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)
                : products.length === 0
                  ? <div className="col-span-full py-16 text-center text-gray-400">محصولی یافت نشد</div>
                  : products.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
