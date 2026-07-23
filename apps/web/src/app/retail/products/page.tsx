'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api';
import { toman } from '@/lib/retail-cart';

type Product = {
  id: string;
  name: string;
  slug: string;
  fabric?: string;
  retailPrice?: number | null;
  images?: string[];
  variants?: Array<{ color: string; size: string }>;
};

function mediaUrl(url?: string) {
  if (!url) return undefined;
  if (url.startsWith('http') || url.startsWith('/')) return url;
  return `/media/${url}`;
}

export default function RetailProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [fabric, setFabric] = useState('');
  const [color, setColor] = useState('');
  const [size, setSize] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ limit: '48', status: 'ACTIVE' });
        if (fabric) params.set('fabric', fabric);
        if (color) params.set('color', color);
        if (size) params.set('size', size);
        if (q.trim()) params.set('search', q.trim());
        const data = await apiClient.get<{ data: Product[] }>(`/products?${params}`);
        if (!cancelled) setProducts(data.data ?? []);
      } catch {
        if (!cancelled) setProducts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fabric, color, size, q]);

  const fabrics = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => p.fabric && set.add(p.fabric));
    return [...set];
  }, [products]);

  const colors = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => (p.variants ?? []).forEach((v) => v.color && set.add(v.color)));
    return [...set];
  }, [products]);

  return (
    <div className="pb-16">
      <div className="border-b border-[var(--retail-border)] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold text-[var(--retail-gold)]">فروشگاه</p>
          <h1 className="mt-1 text-3xl font-extrabold text-[var(--retail-ink)]">همه محصولات</h1>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input
              className="rounded-xl border border-[var(--retail-border)] px-3 py-2.5 text-sm"
              placeholder="جستجو…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select
              className="rounded-xl border border-[var(--retail-border)] px-3 py-2.5 text-sm"
              value={fabric}
              onChange={(e) => setFabric(e.target.value)}
            >
              <option value="">همه پارچه‌ها</option>
              {['لینن', 'کتان', ...fabrics.filter((f) => !['لینن', 'کتان'].includes(f))].map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
            <select
              className="rounded-xl border border-[var(--retail-border)] px-3 py-2.5 text-sm"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            >
              <option value="">همه رنگ‌ها</option>
              {colors.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select
              className="rounded-xl border border-[var(--retail-border)] px-3 py-2.5 text-sm"
              value={size}
              onChange={(e) => setSize(e.target.value)}
            >
              <option value="">همه سایزها</option>
              <option value="FREE">فری‌سایز</option>
              <option value="TWO">دو سایز</option>
              <option value="THREE">سه سایز</option>
            </select>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
        {loading ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-[var(--retail-bg)]" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <p className="py-16 text-center text-[var(--retail-muted)]">محصولی با این فیلتر پیدا نشد</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
            {products.map((p) => {
              const img = mediaUrl(p.images?.[0]);
              const price = Number(p.retailPrice ?? 0);
              return (
                <Link
                  key={p.id}
                  href={`/retail/products/${p.slug}`}
                  className="group overflow-hidden rounded-xl bg-white ring-1 ring-[var(--retail-border)] transition hover:ring-[var(--retail-primary)]/40"
                >
                  <div className="relative aspect-[3/4] bg-[var(--retail-bg)]">
                    {img ? (
                      <Image src={img} alt={p.name} fill className="object-cover transition duration-500 group-hover:scale-105" sizes="(max-width:768px) 50vw, 25vw" />
                    ) : null}
                  </div>
                  <div className="p-3 sm:p-4">
                    <h2 className="line-clamp-2 text-sm font-semibold">{p.name}</h2>
                    <p className="mt-2 text-sm font-extrabold text-[var(--retail-primary)]">
                      {price > 0 ? `${toman(price)} تومان` : 'قیمت به‌زودی'}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
