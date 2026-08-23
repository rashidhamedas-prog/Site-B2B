'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Heart } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { isInWishlist, toggleWishlist } from '@/lib/retail-wishlist';
import { useRetailCart } from '@/lib/retail-cart';
import { discountPercent, mediaUrl, toman, uniqueByColor, uniqueSizes } from '@/lib/product-display';
import { getProductCanonicalPath } from '@/lib/canonical-urls';

export type RetailCardProduct = {
  id: string;
  name: string;
  slug: string;
  sku?: string;
  fabric?: string | null;
  retailPrice?: number | null;
  retailCompareAtPrice?: number | null;
  images?: string[];
  stock?: number;
  totalStock?: number;
  isNew?: boolean;
  isPreOrder?: boolean;
  sale?: {
    active?: boolean;
    payable?: number;
    original?: number | null;
    badgePercent?: number;
  };
  variants?: Array<{
    id?: string;
    color?: string;
    colorHex?: string;
    size?: string;
    stock?: number;
    retailStock?: number;
  }>;
};

export function RetailProductCard({
  product,
  compact = false,
}: {
  product: RetailCardProduct;
  compact?: boolean;
}) {
  const addItem = useRetailCart((s) => s.addItem);
  const [wishlisted, setWishlisted] = useState(false);
  const [added, setAdded] = useState(false);
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
  const secondImage = mediaUrl(product.images?.[1]);
  const href = getProductCanonicalPath(product.slug);
  const colors = useMemo(() => uniqueByColor(product.variants ?? []), [product.variants]);
  const sizes = useMemo(() => uniqueSizes(product.variants ?? []), [product.variants]);
  const [color, setColor] = useState(colors[0]?.color ?? '');
  const [size, setSize] = useState(sizes[0] ?? '');
  const stock =
    product.stock ??
    product.totalStock ??
    (product.variants ?? []).reduce((sum, v) => sum + Number(v.retailStock ?? v.stock ?? 0), 0);
  const soldOut = !product.isPreOrder && stock <= 0;

  useEffect(() => setWishlisted(isInWishlist(product.id)), [product.id]);

  const selectedVariant = (product.variants ?? []).find(
    (v) => (!color || v.color === color) && (!size || v.size === size),
  );
  const needsSize = sizes.length > 1;
  const canQuickAdd =
    !soldOut && price > 0 && (product.isPreOrder || stock > 0) && (!sizes.length || !!size);

  const onWishlist = () => {
    setWishlisted(
      toggleWishlist({
        productId: product.id,
        slug: product.slug,
        name: product.name,
        imageUrl: image,
        price,
      }),
    );
  };

  const onAdd = () => {
    if (!canQuickAdd) return;
    addItem({
      productId: product.id,
      productName: product.name,
      sku: product.sku ?? '',
      unitPrice: price,
      quantity: 1,
      imageUrl: image,
      color,
      size,
      variantId: selectedVariant?.id,
    });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1600);
  };

  return (
    <article className="group relative flex h-full flex-col bg-transparent transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(15,47,40,0.08)] focus-within:shadow-[0_16px_40px_rgba(15,47,40,0.08)] motion-reduce:transform-none motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <div className="relative aspect-[3/4] overflow-hidden bg-[var(--retail-card)]">
        <Link href={href} className="absolute inset-0 z-[1] cursor-pointer focus:outline-none" aria-label={`مشاهده ${product.name}`}>
          {image ? (
            <>
              <Image
                src={image}
                alt={product.name}
                fill
                loading="lazy"
                className={`object-cover transition duration-500 group-hover:scale-[1.03] motion-reduce:transition-none ${soldOut ? 'opacity-60 grayscale' : ''}`}
                sizes="(max-width:768px) 50vw, (max-width:1024px) 33vw, 25vw"
              />
              {!compact && secondImage && !soldOut ? (
                <Image
                  src={secondImage}
                  alt=""
                  aria-hidden
                  fill
                  loading="lazy"
                  className="hidden object-cover opacity-0 transition duration-500 group-hover:opacity-100 md:block motion-reduce:hidden"
                  sizes="25vw"
                />
              ) : null}
            </>
          ) : (
            <span className="flex h-full items-center justify-center text-sm text-[var(--retail-muted)]">
              تصویر به‌زودی
            </span>
          )}
        </Link>

        <div className="pointer-events-none absolute inset-x-0 top-0 z-[2] flex items-start justify-between p-2.5 sm:p-3">
          <div className="flex flex-col items-start gap-1.5">
            {discount ? (
              <span className="rounded-full bg-[var(--retail-gold)] px-2.5 py-1 text-[10px] font-bold text-[var(--retail-primary-dark)]">
                ٪{discount.toLocaleString('fa-IR')} تخفیف
              </span>
            ) : null}
            {product.isNew ? (
              <span className="rounded-full border border-[var(--retail-gold)] bg-white/90 px-2.5 py-1 text-[10px] font-bold text-[var(--retail-primary-dark)]">
                جدید
              </span>
            ) : null}
            {product.isPreOrder ? (
              <span className="rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold text-[var(--retail-primary-dark)]">
                پیش‌فروش
              </span>
            ) : null}
            {soldOut ? (
              <span className="rounded-full bg-[var(--retail-ink)] px-2.5 py-1 text-[10px] font-bold text-white">
                ناموجود
              </span>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={onWishlist}
          aria-label={wishlisted ? `حذف ${product.name} از علاقه‌مندی‌ها` : `افزودن ${product.name} به علاقه‌مندی‌ها`}
          aria-pressed={wishlisted}
          className="absolute left-2 top-2 z-10 inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-white/90 text-[var(--retail-primary)] shadow-sm transition hover:text-[var(--retail-gold)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--retail-gold)] sm:left-3 sm:top-3"
        >
          <Heart className="h-5 w-5" fill={wishlisted ? 'currentColor' : 'none'} aria-hidden />
        </button>

        {stock > 0 && stock <= 4 ? (
          <span className="absolute bottom-3 right-3 z-[2] rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold text-[var(--retail-primary-dark)]">
            فقط {stock.toLocaleString('fa-IR')} عدد
          </span>
        ) : null}

        <Link
          href={href}
          tabIndex={-1}
          aria-hidden
          className="pointer-events-none absolute inset-x-3 bottom-3 z-[2] hidden min-h-11 items-center justify-center rounded-md bg-[var(--retail-primary)]/95 text-xs font-bold text-white opacity-0 transition duration-200 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 md:flex motion-reduce:hidden"
        >
          {soldOut ? 'مشاهده جزئیات' : 'انتخاب سایز'}
        </Link>
      </div>

      <div className={`flex flex-1 flex-col text-center ${compact ? 'gap-1.5 px-1.5 py-3' : 'gap-2.5 px-2 py-4'}`}>
        {colors.length > 0 ? (
          <div
            className={`flex flex-wrap items-center justify-center gap-0.5 ${compact ? '' : 'pt-0.5'}`}
            aria-label={`${colors.length.toLocaleString('fa-IR')} رنگ`}
          >
            {colors.slice(0, compact ? 5 : 6).map((variant) =>
              compact ? (
                <span
                  key={variant.color}
                  title={variant.color}
                  className="h-3.5 w-3.5 rounded-full border border-black/10"
                  style={{ backgroundColor: variant.colorHex || '#d6d3d1' }}
                />
              ) : (
                <button
                  key={variant.color}
                  type="button"
                  title={variant.color}
                  aria-label={variant.color}
                  aria-pressed={color === variant.color}
                  onClick={() => setColor(variant.color ?? '')}
                  className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--retail-gold)]"
                >
                  <span
                    className={`block h-5 w-5 rounded-full border ${
                      color === variant.color
                        ? 'border-[var(--retail-primary)] ring-2 ring-[var(--retail-primary)]/25'
                        : 'border-[var(--retail-border)]'
                    }`}
                    style={{ backgroundColor: variant.colorHex || '#d6d3d1' }}
                  />
                </button>
              ),
            )}
            {colors.length > (compact ? 5 : 6) ? (
              <span className="text-[10px] text-[var(--retail-muted)]">
                +{(colors.length - (compact ? 5 : 6)).toLocaleString('fa-IR')}
              </span>
            ) : null}
          </div>
        ) : null}

        <Link
          href={href}
          className="mx-auto rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--retail-gold)]"
        >
          <h3 className="line-clamp-2 min-h-10 text-[13px] font-bold leading-5 text-[var(--retail-ink)] sm:text-sm">
            {product.name}
          </h3>
        </Link>
        {product.fabric ? (
          <p className="text-[11px] text-[var(--retail-muted)]">{product.fabric}</p>
        ) : null}

        <div>
          <p className="text-sm font-extrabold text-[var(--retail-primary)]">
            {price > 0 ? `${toman(price)} تومان` : 'قیمت به‌زودی'}
          </p>
          {discount ? (
            <p className="text-[11px] text-[var(--retail-muted)] line-through">{toman(compareAt)}</p>
          ) : null}
        </div>

        {!compact && sizes.length > 0 ? (
          <div className="flex flex-wrap items-center justify-center gap-1.5" aria-label="سایز">
            {sizes.slice(0, 6).map((row) => (
              <button
                key={row}
                type="button"
                onClick={() => setSize(row)}
                className={`min-h-9 min-w-9 cursor-pointer rounded-full border px-2.5 text-[11px] ${
                  size === row
                    ? 'border-[var(--retail-primary)] bg-[var(--retail-primary)]/5 font-bold text-[var(--retail-primary)]'
                    : 'border-[var(--retail-border)] text-[var(--retail-ink)]'
                }`}
              >
                {row}
              </button>
            ))}
          </div>
        ) : null}

        {compact ? (
          <Link
            href={href}
            className="mt-auto inline-flex min-h-11 items-center justify-center text-xs font-bold text-[var(--retail-primary)] underline-offset-4 transition hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--retail-gold)] md:sr-only"
          >
            انتخاب سایز
            <ArrowLeft className="mr-1 h-3.5 w-3.5" aria-hidden />
          </Link>
        ) : soldOut ? (
          <Link
            href={href}
            className="mt-auto inline-flex min-h-12 cursor-pointer items-center justify-center rounded-md border border-[var(--retail-border)] px-3 text-sm font-bold text-[var(--retail-ink)] transition hover:border-[var(--retail-gold)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--retail-gold)]"
          >
            مشاهده جزئیات
          </Link>
        ) : needsSize && !size ? (
          <Link
            href={href}
            className="mt-auto inline-flex min-h-12 cursor-pointer items-center justify-center rounded-md bg-[var(--retail-primary)] px-3 text-sm font-bold text-white transition hover:bg-[var(--retail-primary-dark)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--retail-gold)]"
          >
            انتخاب سایز
          </Link>
        ) : (
          <button
            type="button"
            disabled={!canQuickAdd}
            onClick={onAdd}
            className="mt-auto inline-flex min-h-12 cursor-pointer items-center justify-center rounded-md bg-[var(--retail-primary)] px-3 text-sm font-bold text-white transition hover:bg-[var(--retail-primary-dark)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--retail-gold)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {added ? 'به سبد اضافه شد' : 'افزودن به سبد'}
          </button>
        )}
        <span className="sr-only" aria-live="polite">
          {added ? `${product.name} به سبد اضافه شد` : ''}
        </span>
      </div>
    </article>
  );
}
