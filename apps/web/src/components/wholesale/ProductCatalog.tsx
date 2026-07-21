'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ProductImage } from '@/components/ui/ProductImage';
import { Search, SlidersHorizontal, X, ChevronDown } from 'lucide-react';
import { Input, Button, Badge } from '@/components/ui';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/cn';

interface SearchParams {
  fabric?: string;
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
  variants: { id: string; color: string; colorHex?: string; stock: number }[];
}

const FABRICS = ['همه', 'لینن', 'کتان', 'لینن‌کتان', 'ویسکوز'];
const SORT_OPTIONS = [
  { value: 'newest', label: 'جدیدترین' },
  { value: 'popular', label: 'پرفروش‌ترین' },
  { value: 'price_asc', label: 'ارزان‌ترین' },
  { value: 'price_desc', label: 'گران‌ترین' },
];

function FilterPanel({ activeFilters, onFilter, onReset }: {
  activeFilters: SearchParams;
  onFilter: (key: string, value: string) => void;
  onReset: () => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-semibold text-gray-900 mb-3">نوع پارچه</h4>
        <div className="flex flex-wrap gap-2">
          {FABRICS.map((f) => (
            <button key={f} onClick={() => onFilter('fabric', f === 'همه' ? '' : f)}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                (activeFilters.fabric === f || (f === 'همه' && !activeFilters.fabric))
                  ? 'bg-primary text-white border-primary' : 'border-gray-200 text-gray-600 hover:border-primary hover:text-primary')}>
              {f}
            </button>
          ))}
        </div>
      </div>
      <Button variant="ghost" size="sm" fullWidth onClick={onReset} className="text-gray-500">پاک کردن فیلترها</Button>
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

export function ProductCatalog({ searchParams }: { searchParams: SearchParams }) {
  const [filters, setFilters] = useState<SearchParams>(searchParams ?? {});
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [sort, setSort] = useState(searchParams.sort ?? 'newest');
  const [search, setSearch] = useState(searchParams.q ?? '');
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    params.set('limit', '24');
    if (search) params.set('search', search);
    if (filters.fabric) params.set('fabric', filters.fabric);
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
      } finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [buildQuery]);

  const handleFilter = (key: string, value: string) => setFilters((p) => ({ ...p, [key]: value || undefined }));
  const resetFilters = () => setFilters({});
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="min-h-screen bg-atmosphere">
      <div className="border-b border-[color:var(--color-border)] bg-white">
        <div className="container-site py-8 sm:py-10">
          <nav className="mb-4 flex items-center gap-2 text-sm text-gray-500">
            <Link href="/" className="cursor-pointer transition-colors duration-200 hover:text-primary">خانه</Link>
            <span>/</span>
            <span className="font-medium text-gray-900">محصولات</span>
          </nav>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">کاتالوگ محصولات</h1>
          <p className="mt-2 text-sm text-gray-500">مانتو شومیزی زنانه — لینن و کتان، مستقیم از تولیدی</p>
        </div>
      </div>

      <div className="container-site py-8">
        <div className="mb-8 flex flex-wrap items-center gap-3">
          <div className="min-w-[200px] max-w-sm flex-1">
            <Input placeholder="جستجو در محصولات..." value={search}
              onChange={(e) => setSearch(e.target.value)}
              rightIcon={<Search className="h-4 w-4" />} />
          </div>
          <div className="mr-auto flex items-center gap-2">
            <div className="relative">
              <select value={sort} onChange={(e) => setSort(e.target.value)}
                className="input-base h-10 cursor-pointer appearance-none pl-8 pr-4 text-sm">
                {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </div>
            <Button variant="outline" size="md" className="lg:hidden"
              onClick={() => setMobileFiltersOpen(true)}
              rightIcon={<SlidersHorizontal className="h-4 w-4" />}>
              فیلتر {activeFilterCount > 0 && `(${activeFilterCount})`}
            </Button>
          </div>
        </div>

        <div className="flex gap-8">
          <aside className="hidden w-56 flex-shrink-0 lg:block">
            <div className="sticky top-28 border border-[color:var(--color-border)] bg-white p-5">
              <h3 className="mb-5 text-sm font-bold text-gray-900">فیلترها</h3>
              <FilterPanel activeFilters={filters} onFilter={handleFilter} onReset={resetFilters} />
            </div>
          </aside>

          {mobileFiltersOpen && (
            <>
              <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileFiltersOpen(false)} />
              <aside className="fixed inset-y-0 right-0 z-50 w-72 overflow-y-auto bg-white shadow-xl lg:hidden">
                <div className="p-5">
                  <div className="mb-6 flex items-center justify-between">
                    <h3 className="font-bold text-gray-900">فیلترها</h3>
                    <button onClick={() => setMobileFiltersOpen(false)} className="cursor-pointer rounded-lg p-1 transition-colors duration-200 hover:bg-gray-100">
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
                  : products.map((p) => <ProductCard key={p.id} product={p} />)
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
