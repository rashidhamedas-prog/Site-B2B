'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Heart, ShieldCheck, Truck } from 'lucide-react';
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

  useEffect(() => setWishlisted(isInWishlist(product.id)), [product.id]);

  const selectedVariant = (product.variants ?? []).find(
    (v) => (!color || v.color === color) && (!size || v.size === size),
  );
  const canQuickAdd = price > 0 && (product.isPreOrder || stock > 0) && (!sizes.length || !!size);

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
    <article className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-[var(--retail-border)] bg-[var(--retail-bg)] transition duration-300 hover:border-[var(--retail-gold)] focus-within:ring-2 focus-within:ring-[var(--retail-gold)] focus-within:ring-offset-2 motion-reduce:transition-none">
      <div className="relative aspect-[3/4] overflow-hidden bg-[var(--retail-card)]">
        <Link href={href} className="absolute inset-0 z-[1] focus:outline-none" aria-label={`مشاهده ${product.name}`}>
          {image ? (
            <>
              <Image
                src={image}
                alt={product.name}
                fill
                className="object-cover transition duration-300 group-hover:scale-[1.025] motion-reduce:transition-none"
                sizes="(max-width:768px) 50vw, 25vw"
              />
              {secondImage ? (
                <Image
                  src={secondImage}
                  alt=""
                  aria-hidden
                  fill
                  className="hidden object-cover opacity-0 transition duration-300 group-hover:opacity-100 md:block motion-reduce:hidden"
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
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[2] flex items-start justify-between p-3">
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
          </div>
        </div>
        <button
          type="button"
          onClick={onWishlist}
          aria-label={wishlisted ? `حذف ${product.name} از علاقه‌مندی‌ها` : `افزودن ${product.name} به علاقه‌مندی‌ها`}
          aria-pressed={wishlisted}
          className="absolute left-3 top-3 z-10 inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-[var(--retail-border)] bg-[var(--retail-bg)]/90 text-[var(--retail-primary)] transition hover:text-[var(--retail-gold)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--retail-gold)]"
        >
          <Heart className="h-5 w-5" fill={wishlisted ? 'currentColor' : 'none'} aria-hidden />
        </button>
        {stock > 0 && stock <= 4 ? (
          <span className="absolute bottom-3 right-3 z-[2] rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold text-[var(--retail-primary-dark)]">
            فقط {stock.toLocaleString('fa-IR')} عدد
          </span>
        ) : null}
        {(product.images?.length ?? 0) > 1 ? (
          <span className="absolute bottom-3 left-3 z-[2] rounded-full bg-white/90 px-2.5 py-1 text-[10px] text-[var(--retail-ink)]">
            ۱/{(product.images?.length ?? 1).toLocaleString('fa-IR')}
          </span>
        ) : null}
      </div>

      <div className={`flex flex-1 flex-col ${compact ? 'gap-2 p-3' : 'gap-3 p-4'}`}>
        <div className="flex items-start justify-between gap-3">
          <Link href={href} className="rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--retail-gold)]">
            <h3 className="line-clamp-2 min-h-10 text-sm font-bold leading-5 text-[var(--retail-ink)] sm:text-base">
              {product.name}
            </h3>
          </Link>
          <div className="shrink-0 text-left">
            <p className="text-sm font-bold text-[var(--retail-primary)]">
              {price > 0 ? `${toman(price)} تومان` : 'قیمت به‌زودی'}
            </p>
            {discount ? (
              <p className="text-[11px] text-[var(--retail-muted)] line-through">{toman(compareAt)}</p>
            ) : null}
          </div>
        </div>

        {!compact && colors.length > 0 ? (
          <div className="flex items-center gap-2 border-t border-[var(--retail-border)] pt-3">
            <span className="w-10 text-[11px] text-[var(--retail-muted)]">رنگ:</span>
            <div className="flex flex-wrap gap-1.5" aria-label={`${colors.length.toLocaleString('fa-IR')} رنگ`}>
              {colors.slice(0, 4).map((variant) => (
                <button
                  key={variant.color}
                  type="button"
                  title={variant.color}
                  aria-label={variant.color}
                  aria-pressed={color === variant.color}
                  onClick={() => setColor(variant.color ?? '')}
                  className={`h-6 w-6 rounded-full border ${
                    color === variant.color
                      ? 'border-[var(--retail-primary)] ring-2 ring-[var(--retail-primary)]/20'
                      : 'border-[var(--retail-border)]'
                  }`}
                  style={{ backgroundColor: variant.colorHex || '#d6d3d1' }}
                />
              ))}
            </div>
            {colors.length > 4 ? (
              <span className="text-[10px] text-[var(--retail-muted)]">
                +{(colors.length - 4).toLocaleString('fa-IR')} رنگ
              </span>
            ) : null}
          </div>
        ) : null}

        {!compact && sizes.length > 0 ? (
          <div className="flex items-center gap-2">
            <span className="w-10 text-[11px] text-[var(--retail-muted)]">سایز:</span>
            <div className="flex flex-wrap gap-1.5">
              {sizes.slice(0, 5).map((row) => (
                <button
                  key={row}
                  type="button"
                  onClick={() => setSize(row)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] ${
                    size === row
                      ? 'border-[var(--retail-primary)] bg-[var(--retail-primary)]/5 text-[var(--retail-primary)]'
                      : 'border-[var(--retail-border)] text-[var(--retail-ink)]'
                  }`}
                >
                  {row}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {compact ? (
          <Link
            href={href}
            className="mt-auto inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--retail-primary)] px-3 text-xs font-bold text-[var(--retail-primary)] transition hover:bg-[var(--retail-primary)] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--retail-gold)]"
          >
            مشاهده و انتخاب سایز
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          </Link>
        ) : (
          <button
            type="button"
            disabled={!canQuickAdd}
            onClick={onAdd}
            className="mt-auto inline-flex min-h-12 items-center justify-center rounded-lg bg-[var(--retail-primary)] px-3 text-sm font-bold text-white transition hover:bg-[var(--retail-primary-dark)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--retail-gold)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {added ? 'به سبد اضافه شد' : 'افزودن به سبد'}
          </button>
        )}

        {!compact ? (
          <div className="flex items-center justify-center gap-4 border-t border-[var(--retail-border)] pt-2 text-[10px] text-[var(--retail-muted)]">
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              تضمین اصالت
            </span>
            <span className="inline-flex items-center gap-1">
              <Truck className="h-3.5 w-3.5" aria-hidden />
              ارسال سریع
            </span>
          </div>
        ) : null}
      </div>
    </article>
  );
}
