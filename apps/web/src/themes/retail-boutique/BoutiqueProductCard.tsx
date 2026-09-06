'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Heart } from 'lucide-react';
import { isInWishlist, toggleWishlist } from '@/lib/retail-wishlist';
import { discountPercent, mediaUrl, toman } from '@/lib/product-display';
import { getProductCanonicalPath } from '@/lib/canonical-urls';
import type { RetailCardProduct } from '@/components/retail/RetailProductCard';
import { cn } from '@/lib/cn';

export function BoutiqueProductCard({
  product,
  className,
  imagePriority = false,
}: {
  product: RetailCardProduct;
  className?: string;
  imagePriority?: boolean;
}) {
  const sale = product.sale;
  const price = Number(sale?.payable ?? product.retailPrice ?? 0);
  const compareAt = sale?.active
    ? Number(sale.original ?? 0)
    : sale
      ? 0
      : Number(product.retailCompareAtPrice || 0);
  const discount = sale
    ? sale.active
      ? Number(sale.badgePercent || 0)
      : 0
    : discountPercent(price, compareAt);
  const image = mediaUrl(product.images?.[0]);
  const href = getProductCanonicalPath(product.slug);
  const stock =
    typeof product.retailStock === 'number'
      ? product.retailStock
      : (product.variants ?? []).reduce((sum, v) => sum + Math.max(0, Number(v.retailStock) || 0), 0);
  const soldOut = !product.isPreOrder && stock <= 0;
  const [wishlisted, setWishlisted] = useState(false);
  const colors = useMemo(
    () =>
      Array.from(
        new Map(
          (product.variants ?? [])
            .filter((v) => v.color)
            .map((v) => [v.color as string, v] as const),
        ).values(),
      ),
    [product.variants],
  );

  useEffect(() => {
    setWishlisted(isInWishlist(product.id));
  }, [product.id]);

  return (
    <article
      className={cn(
        'flex h-full w-full flex-col overflow-hidden rounded-2xl bg-white text-neutral-900 shadow-sm',
        className,
      )}
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-[#f3eee6]">
        <Link
          href={href}
          prefetch={false}
          className="absolute inset-0"
          aria-label={`مشاهده ${product.name}`}
        >
          {image ? (
            <Image
              src={image}
              alt={product.name}
              fill
              priority={imagePriority}
              loading={imagePriority ? 'eager' : 'lazy'}
              fetchPriority={imagePriority ? 'high' : 'low'}
              className={cn('object-cover', soldOut && 'opacity-60 grayscale')}
              sizes="(max-width:767px) 46vw, (max-width:1280px) 24vw, 288px"
            />
          ) : (
            <span className="flex h-full items-center justify-center text-sm text-neutral-400">
              تصویر به‌زودی
            </span>
          )}
        </Link>
        {discount > 0 ? (
          <span className="absolute right-2 top-2 z-[1] inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#e11d48] text-[11px] font-bold text-white">
            ٪{discount.toLocaleString('fa-IR')}
          </span>
        ) : null}
        <button
          type="button"
          onClick={() =>
            setWishlisted(
              toggleWishlist({
                productId: product.id,
                slug: product.slug,
                name: product.name,
                imageUrl: image,
                price,
              }),
            )
          }
          aria-label={wishlisted ? `حذف ${product.name} از علاقه‌مندی‌ها` : `افزودن ${product.name} به علاقه‌مندی‌ها`}
          aria-pressed={wishlisted}
          className="absolute left-2 top-2 z-[1] inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-[#1b5c4a]"
        >
          <Heart className="h-5 w-5" fill={wishlisted ? 'currentColor' : 'none'} aria-hidden />
        </button>
        {soldOut ? (
          <span className="absolute inset-x-2 bottom-2 z-[1] rounded-full bg-neutral-900/85 px-2 py-1 text-center text-[11px] font-bold text-white">
            ناموجود
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 px-3 py-3 text-right">
        <Link
          href={href}
          prefetch={false}
          className="line-clamp-2 min-h-10 text-sm font-bold leading-5 text-neutral-900"
        >
          {product.name}
        </Link>
        {colors.length > 1 ? (
          <p className="text-[11px] text-neutral-500">{colors.length.toLocaleString('fa-IR')} رنگ</p>
        ) : null}
        <div className="mt-auto flex flex-wrap items-baseline justify-end gap-2">
          {compareAt > price && price > 0 ? (
            <span className="text-xs text-neutral-400 line-through">{toman(compareAt)}</span>
          ) : null}
          {price > 0 ? (
            <span className="text-sm font-extrabold text-neutral-900">
              {toman(price)} <span className="text-[11px] font-medium text-neutral-500">تومان</span>
            </span>
          ) : (
            <span className="text-xs text-neutral-500">برای قیمت، محصول را باز کنید</span>
          )}
        </div>
      </div>
    </article>
  );
}
