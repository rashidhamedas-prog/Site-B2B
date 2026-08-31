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
}: {
  channel: Channel;
  className?: string;
  iconClassName?: string;
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
                  placeholder="جستجوی محصول..."
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
