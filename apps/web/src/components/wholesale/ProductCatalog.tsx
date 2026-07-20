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
    <Link href={`/products/${product.slug}`} className="group card-hover overflow-hidden flex flex-col">
      <div className="relative aspect-[3/4] bg-gradient-to-b from-primary-50 to-primary-100 overflow-hidden">
        <ProductImage
          src={product.images?.[0]}
          alt={product.name}
          sizes="(max-width:640px) 50vw, (max-width:1024px) 33vw, 25vw"
        />
        {!inStock && (
          <div className="absolute top-2 right-2">
            <span className="bg-gray-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">ناموجود</span>
          </div>
        )}
        <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/10 transition-colors" />
      </div>
      <div className="p-4 flex flex-col gap-2 flex-1">
        <h3 className="text-sm font-semibold text-gray-800 line-clamp-2 leading-snug">{product.name}</h3>
        <div className="flex items-center gap-2">
          {product.fabric && <Badge variant="neutral">{product.fabric}</Badge>}
          {colorCount > 0 && <span className="text-xs text-gray-400">{colorCount} رنگ</span>}
        </div>
        <div className="mt-auto pt-1 flex items-end justify-between">
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
    <div className="card overflow-hidden">
      <div className="aspect-[3/4] skeleton" />
      <div className="p-4 space-y-3">
        <div className="skeleton h-4 rounded w-3/4" />
        <div className="skeleton h-3 rounded w-1/2" />
        <div className="skeleton h-5 rounded w-2/3 mt-auto" />
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
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100">
        <div className="container-site py-3">
          <nav className="flex items-center gap-2 text-sm text-gray-500">
            <Link href="/" className="hover:text-primary">خانه</Link>
            <span>/</span>
            <span className="text-gray-900 font-medium">محصولات</span>
          </nav>
        </div>
      </div>

      <div className="container-site py-6">
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <div className="flex-1 min-w-[200px] max-w-sm">
            <Input placeholder="جستجو در محصولات..." value={search}
              onChange={(e) => setSearch(e.target.value)}
              rightIcon={<Search className="h-4 w-4" />} />
          </div>
          <div className="flex items-center gap-2 mr-auto">
            <div className="relative">
              <select value={sort} onChange={(e) => setSort(e.target.value)}
                className="input-base pr-4 pl-8 appearance-none cursor-pointer text-sm h-10">
                {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            </div>
            <Button variant="outline" size="md" className="lg:hidden"
              onClick={() => setMobileFiltersOpen(true)}
              rightIcon={<SlidersHorizontal className="h-4 w-4" />}>
              فیلتر {activeFilterCount > 0 && `(${activeFilterCount})`}
            </Button>
          </div>
        </div>

        <div className="flex gap-6">
          <aside className="hidden lg:block w-56 flex-shrink-0">
            <div className="card p-5 sticky top-24">
              <h3 className="text-sm font-bold text-gray-900 mb-5">فیلترها</h3>
              <FilterPanel activeFilters={filters} onFilter={handleFilter} onReset={resetFilters} />
            </div>
          </aside>

          {mobileFiltersOpen && (
            <>
              <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileFiltersOpen(false)} />
              <aside className="fixed inset-y-0 right-0 z-50 w-72 bg-white shadow-xl overflow-y-auto lg:hidden">
                <div className="p-5">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-gray-900">فیلترها</h3>
                    <button onClick={() => setMobileFiltersOpen(false)} className="rounded-lg p-1 hover:bg-gray-100">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <FilterPanel activeFilters={filters} onFilter={handleFilter} onReset={resetFilters} />
                </div>
              </aside>
            </>
          )}

          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-500 mb-4">
              {!loading && <span className="font-medium text-gray-900">{total.toLocaleString('fa-IR')}</span>}
              {loading ? 'در حال بارگذاری...' : ' محصول یافت شد'}
            </p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
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
