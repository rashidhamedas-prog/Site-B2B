'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';

type Category = {
  id: string;
  name: string;
  bannerUrl?: string | null;
};

const FALLBACK_BANNERS = [
  '/banners/category-2026/01-linen.png',
  '/banners/category-2026/02-outerwear.png',
  '/banners/category-2026/03-sets.png',
  '/banners/category-2026/04-mint.png',
  '/banners/category-2026/05-blouse.png',
  '/banners/category-2026/06-cream.png',
  '/banners/category-2026/07-jacket.png',
  '/banners/category-2026/08-plaid.png',
  '/banners/category-2026/09-blazer.png',
];

function mediaUrl(url?: string | null) {
  if (!url) return undefined;
  if (url.startsWith('http') || url.startsWith('/')) return url;
  return `/media/${url}`;
}

export function RetailCategoryBannerGrid({
  title = 'دسته‌بندی‌ها',
  body,
  columns = 3,
  maxItems = 9,
  categoryIds,
}: {
  title?: string;
  body?: string;
  columns?: number;
  maxItems?: number;
  categoryIds?: string;
}) {
  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.get<Category[]>('/categories');
        const all = Array.isArray(res) ? res : [];
        const idFilter = (categoryIds || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        let list = all;
        if (idFilter.length) {
          const order = new Map(idFilter.map((id, i) => [id, i]));
          list = list
            .filter((c) => order.has(c.id))
            .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
        }
        if (!cancelled) setItems(list.slice(0, Math.max(1, maxItems)));
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [categoryIds, maxItems]);

  const cols = Math.min(4, Math.max(2, columns || 3));
  const gridClass =
    cols === 2
      ? 'grid-cols-2'
      : cols === 4
        ? 'grid-cols-2 sm:grid-cols-4'
        : 'grid-cols-2 sm:grid-cols-3';

  if (!loading && items.length === 0) return null;

  return (
    <section className="bg-[var(--retail-surface)] py-14 sm:py-18">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold tracking-[0.2em] text-[var(--retail-gold)]">CATEGORIES</p>
          <h2 className="mt-2 text-2xl font-extrabold text-[var(--retail-ink)] sm:text-3xl">{title}</h2>
          {body ? (
            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[var(--retail-muted)]">{body}</p>
          ) : null}
        </div>

        {loading ? (
          <div className={`grid gap-3 sm:gap-4 ${gridClass}`}>
            {Array.from({ length: Math.min(maxItems, 9) }).map((_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-sm bg-[var(--retail-card)]" />
            ))}
          </div>
        ) : (
          <div className={`grid gap-3 sm:gap-4 ${gridClass}`}>
            {items.map((c, i) => {
              const img = mediaUrl(c.bannerUrl) || FALLBACK_BANNERS[i % FALLBACK_BANNERS.length];
              return (
                <Link
                  key={c.id}
                  href={`/products?categoryId=${encodeURIComponent(c.id)}`}
                  className="group relative block aspect-square overflow-hidden bg-[#124035] ring-1 ring-[var(--retail-border)] transition hover:ring-[var(--retail-gold)]/60"
                >
                  {img ? (
                    <Image
                      src={img}
                      alt={c.name}
                      fill
                      className="object-cover object-center transition duration-500 group-hover:scale-[1.04]"
                      sizes="(max-width:640px) 50vw, 33vw"
                    />
                  ) : null}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0F2F28]/85 via-[#0F2F28]/25 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
                    <span className="block text-center text-sm font-extrabold text-white sm:text-base">
                      {c.name}
                    </span>
                    <span className="mt-1 block text-center text-[11px] font-medium tracking-wide text-[var(--retail-gold)] opacity-90">
                      مشاهده محصولات
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
