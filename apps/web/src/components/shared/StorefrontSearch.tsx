'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { Search, X } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { mediaUrl, toman } from '@/lib/product-display';
import { cn } from '@/lib/cn';

type Channel = 'RETAIL' | 'WHOLESALE';

type SearchHit = {
  id: string;
  name: string;
  slug: string;
  images?: string[];
  retailPrice?: number | null;
  wholesalePrice?: number | null;
  sale?: { payable?: number; active?: boolean };
};

export function StorefrontSearch({
  channel,
  className,
  iconClassName,
  variant = 'icon',
  placeholder,
}: {
  channel: Channel;
  className?: string;
  iconClassName?: string;
  variant?: 'icon' | 'inline';
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const retail = channel === 'RETAIL';

  const close = useCallback(() => {
    setOpen(false);
    setQ('');
    setHits([]);
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  useEffect(() => {
    const query = q.trim();
    if (!open || query.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await apiClient.get<{ data: SearchHit[] }>(
          `/products?channel=${channel}&search=${encodeURIComponent(query)}&limit=8&status=ACTIVE`,
        );
        setHits(Array.isArray(res.data) ? res.data : []);
      } catch {
        setHits([]);
      } finally {
        setLoading(false);
      }
    }, 280);
    return () => window.clearTimeout(timer);
  }, [q, open, channel]);

  const goCatalog = `/products${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`;
  const searchPlaceholder = placeholder || 'جستجوی محصول...';

  if (variant === 'inline') {
    return (
      <form
        action={goCatalog}
        className={cn('relative min-w-0 flex-1', className)}
        onSubmit={(e) => {
          e.preventDefault();
          window.location.href = goCatalog;
        }}
      >
        <label htmlFor={titleId} className="sr-only">
          جستجوی محصول
        </label>
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden />
        <input
          id={titleId}
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={searchPlaceholder}
          className="h-11 w-full rounded-full bg-white pe-4 ps-10 text-sm text-neutral-900 outline-none placeholder:text-neutral-400"
          autoComplete="off"
        />
        {open && q.trim().length >= 2 ? (
          <div
            role="listbox"
            aria-label="نتایج جستجو"
            className="absolute inset-x-0 top-[calc(100%+0.4rem)] z-[70] overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10"
          >
            {loading ? (
              <p className="px-4 py-5 text-center text-sm text-neutral-400">در حال جستجو...</p>
            ) : hits.length === 0 ? (
              <p className="px-4 py-5 text-center text-sm text-neutral-400">محصولی پیدا نشد</p>
            ) : (
              <ul>
                {hits.map((p) => {
                  const img = mediaUrl(p.images?.[0]);
                  const price = Number(p.sale?.payable ?? (retail ? p.retailPrice : p.wholesalePrice) ?? 0);
                  return (
                    <li key={p.id}>
                      <Link
                        href={`/products/${p.slug}`}
                        onClick={() => {
                          setOpen(false);
                          setQ('');
                        }}
                        className="flex items-center gap-3 px-3 py-2.5 hover:bg-neutral-50"
                      >
                        <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                          {img ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={img} alt="" className="h-full w-full object-cover" />
                          ) : null}
                        </span>
                        <span className="min-w-0 flex-1 text-right">
                          <span className="block truncate text-sm font-medium text-neutral-900">{p.name}</span>
                          {price > 0 ? (
                            <span className="text-xs text-neutral-500">{toman(price)} تومان</span>
                          ) : null}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
            <Link
              href={goCatalog}
              onClick={() => setOpen(false)}
              className="block border-t border-neutral-100 py-2 text-center text-xs font-medium text-neutral-700"
            >
              مشاهده همه نتایج
            </Link>
          </div>
        ) : null}
      </form>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className}
        aria-label="جستجو"
      >
        <Search className={iconClassName ?? 'h-5 w-5'} strokeWidth={retail ? 1.4 : 2} />
      </button>

      {open ? (
        <div className="fixed inset-0 z-[80]">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="بستن جستجو"
            onClick={close}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={cn(
              'absolute inset-x-0 top-0 mx-auto w-full max-w-xl p-3 sm:p-4',
            )}
          >
            <form
              action={goCatalog}
              className={cn(
                'overflow-hidden rounded-2xl shadow-2xl',
                retail ? 'bg-white ring-1 ring-black/10' : 'bg-white ring-1 ring-gray-200',
              )}
              onSubmit={(e) => {
                e.preventDefault();
                window.location.href = goCatalog;
              }}
            >
              <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2.5">
                <Search className="h-5 w-5 shrink-0 text-gray-400" />
                <label htmlFor={titleId} className="sr-only">
                  جستجوی محصول
                </label>
                <input
                  id={titleId}
                  ref={inputRef}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="h-10 w-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={close}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  aria-label="بستن"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="max-h-[min(24rem,60vh)] overflow-y-auto">
                {q.trim().length < 2 ? (
                  <p className="px-4 py-6 text-center text-sm text-gray-400">
                    حداقل دو حرف بنویسید
                  </p>
                ) : loading ? (
                  <p className="px-4 py-6 text-center text-sm text-gray-400">در حال جستجو...</p>
                ) : hits.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-gray-400">محصولی پیدا نشد</p>
                ) : (
                  <ul>
                    {hits.map((p) => {
                      const img = mediaUrl(p.images?.[0]);
                      const price = Number(p.sale?.payable ?? (retail ? p.retailPrice : p.wholesalePrice) ?? 0);
                      return (
                        <li key={p.id}>
                          <Link
                            href={`/products/${p.slug}`}
                            onClick={close}
                            className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50"
                          >
                            <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                              {img ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={img} alt="" className="h-full w-full object-cover" />
                              ) : null}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-gray-900">
                                {p.name}
                              </span>
                              {price > 0 ? (
                                <span className="text-xs text-gray-500">
                                  {toman(price)} تومان
                                </span>
                              ) : null}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <div className="border-t border-gray-100 px-3 py-2">
                <Link
                  href={goCatalog}
                  onClick={close}
                  className={cn(
                    'block py-1.5 text-center text-xs font-medium',
                    retail ? 'text-[var(--retail-ink)]' : 'text-primary',
                  )}
                >
                  مشاهده همه نتایج
                </Link>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
