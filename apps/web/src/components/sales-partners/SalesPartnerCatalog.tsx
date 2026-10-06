'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Copy, ExternalLink, FileText, Search, ShoppingBag } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { mediaUrl, toman } from '@/lib/product-display';
import { SalesPartnerShell, SpAlert, SpEmpty, SpNote, spField } from './SalesPartnerShell';
import { SpButton, SpPageSkeleton, spChipClass, useSpToast } from './SpUi';

type CatalogItem = {
  id: string;
  name: string;
  slug: string | null;
  categoryId: string | null;
  categoryName: string;
  blurb: string | null;
  priceIrr: number;
  priceLabel: string;
  stockBand: 'in_stock' | 'low' | 'out_of_stock';
  stockLabel: string;
  estimatedCommissionIrr: number;
  commissionPercent: number;
  images: string[];
  productUrl: string;
  copyText: string;
  updatedAt: string;
};

type CatalogFacet = { id: string | null; name: string; count: number };

type CatalogResponse = {
  items: CatalogItem[];
  page: number;
  pageSize: number;
  total: number;
  sort: 'category' | 'price_asc' | 'price_desc' | 'commission';
  facets: {
    categories: CatalogFacet[];
    stock: { all: number; available: number; out: number };
  };
};

type SortKey = CatalogResponse['sort'];

function sectionsOf(items: CatalogItem[], sort: SortKey) {
  if (sort !== 'category') return [{ id: 'results', name: 'نتایج', items }];
  const groups: { id: string; name: string; items: CatalogItem[] }[] = [];
  for (const item of items) {
    const id = item.categoryId || 'none';
    const last = groups[groups.length - 1];
    if (last && last.id === id) last.items.push(item);
    else groups.push({ id, name: item.categoryName || 'بدون دسته', items: [item] });
  }
  return groups;
}

export function SalesPartnerCatalog() {
  const toast = useSpToast();
  const [data, setData] = useState<CatalogResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [sort, setSort] = useState<SortKey>('category');
  const [page, setPage] = useState(1);
  const filtersKey = `${debouncedQ}|${categoryId}|${sort}`;
  const prevFilters = useRef(filtersKey);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    const filtersChanged = prevFilters.current !== filtersKey;
    prevFilters.current = filtersKey;
    if (filtersChanged && page !== 1) {
      setPage(1);
      return;
    }
    const nextPage = filtersChanged ? 1 : page;
    const params = new URLSearchParams();
    if (nextPage > 1) params.set('page', String(nextPage));
    if (debouncedQ) params.set('q', debouncedQ);
    if (categoryId) params.set('categoryId', categoryId);
    if (sort !== 'category') params.set('sort', sort);
    const qs = params.toString();
    let cancelled = false;
    setLoading(true);
    apiClient
      .get<CatalogResponse>(`/sales-partners/catalog${qs ? `?${qs}` : ''}`)
      .then((next) => {
        if (!cancelled) {
          setData(next);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'بارگذاری کاتالوگ ناموفق بود');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filtersKey, page, debouncedQ, categoryId, sort]);

  async function copyValue(item: CatalogItem, kind: 'link' | 'text') {
    const value = kind === 'link' ? item.productUrl : item.copyText;
    try {
      await navigator.clipboard.writeText(value);
      toast.show(kind === 'link' ? 'لینک فروش کپی شد' : 'متن معرفی کپی شد');
      setError(null);
    } catch {
      setError('کپی خودکار ممکن نشد. لینک را از کادر انتخاب کنید.');
    }
  }

  const sections = useMemo(
    () => sectionsOf(data?.items || [], data?.sort || sort),
    [data, sort],
  );
  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const categoryTotal = (data?.facets.categories || []).reduce((sum, facet) => sum + facet.count, 0);
  const filtersActive = Boolean(debouncedQ || categoryId || sort !== 'category');

  function clearFilters() {
    setQ('');
    setDebouncedQ('');
    setCategoryId('');
    setSort('category');
  }

  return (
    <SalesPartnerShell title="محصولات قابل فروش" wide>
      <SpNote>
        هر لینک مخصوص شماست. اگر مشتری از همان لینک بخرد، پورسانت همان کالا بعد از پرداخت حساب می‌شود. هزینه ارسال و کیف
        پول داخل پورسانت نیست. فقط کالاهایی که موجودی فروش تکی دارند در این فهرست می‌آیند.
      </SpNote>

      <div className="sticky top-0 z-10 -mx-4 mt-4 space-y-3 border-b border-stone-200/80 bg-[#f6f3ee]/95 px-4 py-3 backdrop-blur-md lg:mx-0 lg:rounded-3xl lg:border lg:px-4">
        <label className="relative block" htmlFor="sp-catalog-q">
          <span className="sr-only">جستجوی محصول یا دسته</span>
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" aria-hidden />
          <input
            id="sp-catalog-q"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            className={`${spField} pr-10`}
            placeholder="نام محصول یا دسته"
          />
        </label>
        <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="دسته‌ها">
          <button type="button" className={spChipClass(categoryId === '')} aria-pressed={categoryId === ''} onClick={() => setCategoryId('')}>
            همه
            <span className="tabular-nums opacity-80">{categoryTotal.toLocaleString('fa-IR')}</span>
          </button>
          {(data?.facets.categories || []).filter((facet) => facet.id).map((facet) => {
            const id = facet.id || '';
            const active = categoryId === id && id !== '';
            return (
              <button
                key={id || facet.name}
                type="button"
                className={spChipClass(active)}
                aria-pressed={active}
                onClick={() => setCategoryId(id)}
              >
                {facet.name}
                <span className="tabular-nums opacity-80">{facet.count.toLocaleString('fa-IR')}</span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="mr-auto flex items-center gap-2 text-sm text-stone-600" htmlFor="sp-catalog-sort">
            مرتب‌سازی
            <select
              id="sp-catalog-sort"
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
              className={`${spField} w-auto min-w-36 pr-3`}
            >
              <option value="category">دسته</option>
              <option value="price_asc">ارزان‌تر</option>
              <option value="price_desc">گران‌تر</option>
              <option value="commission">پورسانت بیشتر</option>
            </select>
          </label>
        </div>
      </div>

      <p className="mt-4 text-sm text-stone-600" role="status">
        {loading ? 'در حال به‌روزرسانی…' : `${(data?.total ?? 0).toLocaleString('fa-IR')} محصول`}
        {filtersActive && !loading ? (
          <button type="button" className="mr-3 text-[#1B5C4A] underline-offset-4 hover:underline" onClick={clearFilters}>
            پاک کردن فیلتر
          </button>
        ) : null}
      </p>
      {error && (
        <div className="mt-4">
          <SpAlert>{error}</SpAlert>
        </div>
      )}
      {loading && !data && <SpPageSkeleton cards={2} />}
      {!loading && data && data.items.length === 0 && (
        <div className="mt-6">
          <SpEmpty>
            {filtersActive
              ? 'با این فیلتر محصولی نیست. فیلتر را بردارید یا دستهٔ دیگری را انتخاب کنید.'
              : 'الان کالای موجودی برای معرفی نیست. به‌محض موجود شدن در فروشگاه تکی، لینک فروش اینجا می‌آید.'}
          </SpEmpty>
        </div>
      )}

      <div className="mt-5 space-y-8">
        {sections.map((section) => (
          <section key={section.id} aria-labelledby={`sp-cat-${section.id}`}>
            {sort === 'category' && (
              <h2 id={`sp-cat-${section.id}`} className="mb-3 text-sm font-semibold text-[#1B5C4A]">
                {section.name}
              </h2>
            )}
            <ul className="grid gap-4 md:grid-cols-2">
              {section.items.map((item, index) => {
                const src = mediaUrl(item.images[0]);
                return (
                  <li key={item.id} className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm shadow-stone-900/5">
                    <div className="relative aspect-[4/3] bg-stone-100">
                      {src ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={src}
                          alt={item.name}
                          className="h-full w-full object-cover"
                          loading={index === 0 ? 'eager' : 'lazy'}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-stone-500">بدون تصویر</div>
                      )}
                    </div>
                    <div className="space-y-3 p-4">
                      <div>
                        {sort !== 'category' && (
                          <p className="text-xs font-medium text-[#1B5C4A]">{item.categoryName}</p>
                        )}
                        <h3 className="text-base font-bold text-stone-900">{item.name}</h3>
                        {item.blurb && <p className="mt-1 text-sm leading-6 text-stone-600">{item.blurb}</p>}
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-[#f6f3ee] px-2.5 py-1 tabular-nums text-stone-700">{item.priceLabel}</span>
                        <span className="rounded-full bg-[#f6f3ee] px-2.5 py-1 text-stone-700">{item.stockLabel}</span>
                      </div>
                      <p className="text-sm leading-6 text-stone-600">
                        {item.commissionPercent > 0
                          ? `پورسانت تخمینی این قیمت: ${toman(item.estimatedCommissionIrr)} تومان (${item.commissionPercent}٪)`
                          : 'درصد پورسانت این محصول هنوز ثبت نشده. تا آن زمان پورسانت فروش از این لینک صفر است.'}
                      </p>
                      <label className="block text-sm font-medium" htmlFor={`sp-link-${item.id}`}>
                        لینک فروش شما
                      </label>
                      <input
                        id={`sp-link-${item.id}`}
                        readOnly
                        value={item.productUrl}
                        dir="ltr"
                        className={spField}
                        onFocus={(event) => event.currentTarget.select()}
                      />
                      <SpButton className="w-full" onClick={() => void copyValue(item, 'link')}>
                        <Copy className="h-4 w-4" aria-hidden />
                        کپی لینک فروش
                      </SpButton>
                      <div className="grid grid-cols-2 gap-2">
                        <SpButton variant="secondary" onClick={() => void copyValue(item, 'text')}>
                          <FileText className="h-4 w-4" aria-hidden />
                          کپی متن
                        </SpButton>
                        <Link
                          href={`/sales-partners/orders/new?productId=${item.id}`}
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-stone-300 bg-white px-3 text-sm text-stone-800 transition-[transform,border-color] duration-200 hover:border-[#1B5C4A]/40 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C9A84C]"
                        >
                          <ShoppingBag className="h-4 w-4" aria-hidden />
                          سفارش مشتری
                        </Link>
                      </div>
                      <a
                        href={item.productUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl text-sm text-[#1B5C4A] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C9A84C]"
                      >
                        <ExternalLink className="h-4 w-4" aria-hidden />
                        باز کردن صفحه محصول
                      </a>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {data && data.total > data.pageSize && (
        <div className="mt-6 flex items-center justify-between gap-3">
          <button type="button" className={spChipClass(false)} disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
            قبلی
          </button>
          <p className="text-sm tabular-nums text-stone-600">
            {page.toLocaleString('fa-IR')} از {pageCount.toLocaleString('fa-IR')}
          </p>
          <button type="button" className={spChipClass(false)} disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)}>
            بعدی
          </button>
        </div>
      )}
    </SalesPartnerShell>
  );
}
