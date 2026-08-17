'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import { searchAdminProducts, type Product } from '@/lib/hooks/useProducts';
import { cn } from '@/lib/cn';

export interface RelatedProductPick {
  id: string;
  name: string;
  sku?: string;
  images?: string[];
}

const MAX_RELATED = 12;

function thumbOf(item: RelatedProductPick): string | null {
  const first = item.images?.[0];
  return typeof first === 'string' && first.trim() ? first : null;
}

function toPick(p: Product): RelatedProductPick {
  const images = Array.isArray(p.images)
    ? p.images.filter((u): u is string => typeof u === 'string' && !!u)
    : [];
  return { id: p.id, name: p.name, sku: p.sku, images };
}

export function ProductRelatedPicker({
  value,
  onChange,
  excludeId,
  max = MAX_RELATED,
}: {
  value: RelatedProductPick[];
  onChange: (items: RelatedProductPick[]) => void;
  excludeId?: string;
  max?: number;
}) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<RelatedProductPick[]>([]);
  const [searching, setSearching] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedKey = value.map((item) => item.id).join(',');
  const atLimit = value.length >= max;

  const runSearch = useCallback(
    async (term: string) => {
      if (term.trim().length < 1) {
        setHits([]);
        return;
      }
      const skip = new Set(selectedKey ? selectedKey.split(',') : []);
      setSearching(true);
      try {
        const rows = await searchAdminProducts(term);
        setHits(
          rows
            .filter((p) => p.id !== excludeId && !skip.has(p.id))
            .slice(0, 12)
            .map(toPick)
        );
      } catch {
        setHits([]);
      } finally {
        setSearching(false);
      }
    },
    [excludeId, selectedKey]
  );

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void runSearch(query);
    }, 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, runSearch]);

  const add = (item: RelatedProductPick) => {
    if (atLimit || selectedKey.split(',').includes(item.id) || item.id === excludeId) return;
    onChange([...value, item]);
    setHits((prev) => prev.filter((h) => h.id !== item.id));
  };

  const remove = (id: string) => {
    onChange(value.filter((item) => item.id !== id));
  };

  const move = (index: number, dir: -1 | 1) => {
    const next = index + dir;
    if (next < 0 || next >= value.length) return;
    const copy = [...value];
    const [row] = copy.splice(index, 1);
    copy.splice(next, 0, row);
    onChange(copy);
  };

  return (
    <div className="space-y-3 rounded-xl border border-gray-100 bg-gray-50/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-gray-800">محصولات مرتبط</p>
        <p className="text-[11px] text-gray-400">
          {value.length} از {max}
        </p>
      </div>
      <p className="text-[11px] text-gray-500">
        حداکثر ۱۲ محصول. ترتیب همین‌جا ذخیره می‌شود.
      </p>

      <div className="relative">
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="جستجو نام یا SKU…"
          className="focus:ring-primary/30 w-full rounded-lg border border-gray-200 bg-white py-2 pl-3 pr-9 text-sm focus:outline-none focus:ring-2"
        />
      </div>

      {searching ? <p className="text-[11px] text-gray-400">در حال جستجو…</p> : null}
      {hits.length > 0 ? (
        <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-gray-100 bg-white">
          {hits.map((hit) => {
            const thumb = thumbOf(hit);
            return (
              <li key={hit.id}>
                <button
                  type="button"
                  disabled={atLimit}
                  onClick={() => add(hit)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-right text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {thumb ? (
                    <img src={thumb} alt="" className="h-9 w-9 shrink-0 rounded object-cover" />
                  ) : (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-gray-100 text-[10px] text-gray-400">
                      بدون عکس
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-gray-800">{hit.name}</span>
                    <span className="block font-mono text-[11px] text-gray-400" dir="ltr">
                      {hit.sku}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {atLimit ? (
        <p className="text-[11px] text-amber-700">به سقف ۱۲ محصول مرتبط رسیده‌اید.</p>
      ) : null}

      {value.length === 0 ? (
        <p className="text-xs text-gray-400">هنوز محصول مرتبطی انتخاب نشده است.</p>
      ) : (
        <ul className="space-y-2">
          {value.map((item, index) => {
            const thumb = thumbOf(item);
            return (
              <li
                key={item.id}
                className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2 py-1.5"
              >
                {thumb ? (
                  <img src={thumb} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-gray-100 text-[10px] text-gray-400">
                    —
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-800">{item.name}</p>
                  <p className="font-mono text-[11px] text-gray-400" dir="ltr">
                    {item.sku}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    title="بالا"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    className={cn(
                      'rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700',
                      index === 0 && 'cursor-not-allowed opacity-30'
                    )}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    title="پایین"
                    disabled={index === value.length - 1}
                    onClick={() => move(index, 1)}
                    className={cn(
                      'rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700',
                      index === value.length - 1 && 'cursor-not-allowed opacity-30'
                    )}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    title="حذف"
                    onClick={() => remove(item.id)}
                    className="hover:text-error rounded p-1 text-gray-400 hover:bg-red-50"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
