'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getWishlist, type WishlistItem } from '@/lib/retail-wishlist';

function mediaUrl(url?: string) {
  if (!url) return undefined;
  if (url.startsWith('http') || url.startsWith('/')) return url;
  return `/media/${url}`;
}

export default function RetailWishlistPage() {
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);

  useEffect(() => {
    setWishlist(getWishlist());
  }, []);

  if (wishlist.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--retail-border)] p-8 text-center">
        <p className="text-sm text-[var(--retail-muted)]">لیست علاقه‌مندی خالی است.</p>
        <Link href="/products" className="mt-4 inline-block rounded-full bg-[var(--retail-gold)] px-5 py-2.5 text-sm font-extrabold text-white">
          مشاهده محصولات
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {wishlist.map((w) => {
        const img = mediaUrl(w.imageUrl);
        return (
          <Link key={w.productId} href={`/products/${w.slug}`} className="flex gap-3 rounded-2xl border border-[var(--retail-border)] p-3">
            <div className="relative h-20 w-16 overflow-hidden rounded-lg bg-[var(--retail-bg)]">
              {img ? <Image src={img} alt={w.name} fill className="object-cover" sizes="64px" /> : null}
            </div>
            <div>
              <p className="text-sm font-bold">{w.name}</p>
              {w.price ? (
                <p className="mt-1 text-xs text-[var(--retail-primary)]">
                  {Math.round(w.price / 10).toLocaleString('fa-IR')} ت
                </p>
              ) : null}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
