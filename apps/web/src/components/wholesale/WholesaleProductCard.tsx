'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { getToken } from '@/lib/auth';
import { channelSaleDisplay, mediaUrl, sizeTypeLabel, toman, uniqueByColor } from '@/lib/product-display';
import { WholesaleQuickOrder } from './WholesaleQuickOrder';
import { resolveProductImageAlt } from '@/lib/product-image-alt';

export type WholesaleCardProduct = {
  id: string;
  slug?: string;
  sku?: string;
  name: string;
  fabric?: string;
  wholesalePrice?: number | null;
  sale?: {
    active?: boolean;
    payable?: number;
    original?: number | null;
    badgePercent?: number;
  };
  status?: string;
  stock?: number;
  wholesaleStock?: number;
  totalStock?: number;
  images?: string[];
  imageAlts?: Record<string, string>;
  sizeType?: string;
  minOrderQty?: number;
  minimumOrderQuantity?: number;
  allowWholesaleColorSelect?: boolean;
  minWholesaleColors?: number;
  variants?: Array<{ color?: string; colorHex?: string; stock?: number; wholesaleStock?: number; size?: string }>;
};

export function WholesaleProductCard({
  product,
  imagePriority = false,
}: {
  product: WholesaleCardProduct;
  imagePriority?: boolean;
}) {
  const [orderOpen, setOrderOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const href = `/products/${product.slug || product.id}`;
  const variants = product.variants ?? [];
  const stock =
    typeof product.wholesaleStock === 'number'
      ? product.wholesaleStock
      : variants.reduce((sum, variant) => sum + Math.max(0, Number(variant.wholesaleStock) || 0), 0);
  const isComingSoon = product.status === 'COMING_SOON';
  const isAvailable = stock > 0 && !isComingSoon;
  const colors = uniqueByColor(variants);
  const { price, compareAt, discount, active: saleActive } = channelSaleDisplay(
    product.sale,
    product.wholesalePrice,
  );
  const showPrice = signedIn && price > 0;
  const moq = product.minOrderQty ?? product.minimumOrderQuantity ?? 6;
  const primaryImage = mediaUrl(product.images?.[0]);
  const secondImage = mediaUrl(product.images?.[1]);
  const sizeLabel = sizeTypeLabel(product.sizeType);
  const specParts = [
    product.fabric || null,
    sizeLabel || null,
    colors.length ? `${colors.length.toLocaleString('fa-IR')} رنگ` : null,
  ].filter(Boolean);

  useEffect(() => {
    setSignedIn(Boolean(getToken()));
  }, []);

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-lg bg-white transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(27,92,74,0.07)] focus-within:shadow-[0_4px_16px_rgba(27,92,74,0.07)] focus-within:ring-2 focus-within:ring-[var(--brand-gold,#C9A84C)] focus-within:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <Link
        href={href}
        prefetch={false}
        className="relative block aspect-[3/4] overflow-hidden bg-[var(--brand-card,#F3EEE6)] focus:outline-none"
      >
        {primaryImage ? (
          <>
            <Image
              src={primaryImage}
              alt={resolveProductImageAlt(product.imageAlts, product.images?.[0], {
                name: product.name,
                fabric: product.fabric,
                index: 0,
              })}
              fill
              priority={imagePriority}
              loading={imagePriority ? 'eager' : 'lazy'}
              fetchPriority={imagePriority ? 'high' : 'low'}
              sizes="(max-width:639px) 46vw, (max-width:1279px) 30vw, 280px"
              className="object-cover object-center transition duration-500 group-hover:scale-[1.02] motion-reduce:transition-none"
            />
            {secondImage ? (
              <Image
                src={secondImage}
                alt=""
                aria-hidden
                fill
                loading="lazy"
                fetchPriority="low"
                sizes="(max-width:639px) 46vw, (max-width:1279px) 30vw, 280px"
                className="hidden object-cover object-center opacity-0 transition duration-500 group-hover:opacity-100 md:block motion-reduce:hidden"
              />
            ) : null}
          </>
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-b from-primary-50 to-primary-100">
            <span className="text-xs text-primary/40">بدون تصویر</span>
          </div>
        )}
        <div className="absolute right-3 top-3">
          <span
            className={`rounded-sm px-2.5 py-1 text-[10px] font-bold ${
              isAvailable
                ? 'bg-[var(--brand-green,#1B5C4A)] text-white'
                : isComingSoon
                  ? 'bg-[var(--brand-gold,#C9A84C)] text-[var(--brand-green-dark,#0F2F28)]'
                  : 'bg-[var(--brand-ink,#1A1A1A)] text-white'
            }`}
          >
            {isAvailable ? 'آماده سفارش' : isComingSoon ? 'به‌زودی' : 'ناموجود'}
          </span>
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-3.5 sm:p-4">
        <div className="mb-1.5 flex items-center justify-between gap-2 text-[10px] text-[var(--brand-muted,#6B7280)]">
          <span className="font-mono tracking-wide" dir="ltr">
            {product.sku || 'TARANOM'}
          </span>
          {saleActive && discount ? (
            <span className="font-bold text-[var(--brand-gold-dark,#A88530)]">
              ٪{discount.toLocaleString('fa-IR')} تخفیف
            </span>
          ) : null}
        </div>

        <Link
          href={href}
          prefetch={false}
          className="rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-gold,#C9A84C)]"
        >
          <h3 className="line-clamp-2 min-h-10 text-sm font-bold leading-5 text-[var(--brand-ink,#1A1A1A)]">
            {product.name}
          </h3>
        </Link>

        {specParts.length ? (
          <p className="mt-2 text-[11px] leading-5 text-[var(--brand-muted,#6B7280)]">
            {specParts.join(' · ')}
          </p>
        ) : null}

        {colors.length ? (
          <div
            className="mt-2.5 flex -space-x-1 space-x-reverse"
            aria-label={`${colors.length.toLocaleString('fa-IR')} رنگ`}
          >
            {colors.slice(0, 5).map((variant) => (
              <span
                key={variant.color}
                className="h-4 w-4 rounded-full border-2 border-white ring-1 ring-black/10"
                style={{ backgroundColor: variant.colorHex || '#d6d3d1' }}
                title={variant.color}
              />
            ))}
          </div>
        ) : null}

        <div className="mt-auto space-y-3 pt-4">
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] text-[var(--brand-muted,#6B7280)]">قیمت همکاری هر عدد</p>
              <p className="mt-0.5 text-base font-black text-[var(--brand-green,#1B5C4A)]">
                {showPrice ? `${toman(price)} تومان` : 'پس از ورود'}
              </p>
              {showPrice && saleActive && compareAt > price ? (
                <p className="text-[11px] text-[var(--brand-muted,#6B7280)] line-through">
                  {toman(compareAt)}
                </p>
              ) : null}
            </div>
            <span className="inline-flex shrink-0 items-center rounded-full bg-[var(--brand-green,#1B5C4A)]/10 px-2.5 py-1 text-[10px] font-bold text-[var(--brand-green,#1B5C4A)]">
              حداقل {moq.toLocaleString('fa-IR')} عدد
            </span>
          </div>
          <button
            type="button"
            onClick={() => setOrderOpen(true)}
            aria-label={`سفارش سریع ${product.name}`}
            className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-lg bg-[var(--brand-green,#1B5C4A)] px-3 text-xs font-bold text-white transition hover:bg-[var(--brand-green-dark,#0F2F28)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-gold,#C9A84C)]"
          >
            سفارش
            <ArrowLeft className="mr-1 h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </div>

      <WholesaleQuickOrder product={product} open={orderOpen} onClose={() => setOrderOpen(false)} />
    </article>
  );
}
