'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import {
  beginProductTransition,
  warmProductRoute,
} from '@/components/motion/product-transition';
import { channelSaleDisplay, mediaUrl, sizeTypeLabel, toman, uniqueInStockColors } from '@/lib/product-display';
import { WholesaleQuickOrder } from './WholesaleQuickOrder';
import { resolveProductImageAlt } from '@/lib/product-image-alt';
import { resolveWholesaleOrderBadge } from '@/lib/wholesale-order-badge';
import { trackSelectItem, trackWholesaleLead } from '@/lib/retail-analytics';
import {
  CATALOG_CARD_IMAGE_QUALITY,
  CATALOG_CARD_IMAGE_SIZES,
} from '@/lib/catalog-performance';

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
  orderBadgeLabel?: string | null;
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
  const router = useRouter();
  const [orderOpen, setOrderOpen] = useState(false);
  const [imageReady, setImageReady] = useState(false);
  const href = `/products/${product.slug || product.id}`;
  const onSelect = () =>
    trackSelectItem(
      {
        productId: product.id,
        sku: product.sku,
        name: product.name,
        price: product.sale?.payable ?? product.wholesalePrice ?? 0,
      },
      'wholesale_catalog',
      'wholesale_catalog',
    );
  const variants = product.variants ?? [];
  const stock =
    typeof product.wholesaleStock === 'number'
      ? product.wholesaleStock
      : variants.reduce((sum, variant) => sum + Math.max(0, Number(variant.wholesaleStock) || 0), 0);
  const isComingSoon = product.status === 'COMING_SOON';
  const isAvailable = stock > 0 && !isComingSoon;
  const colors = uniqueInStockColors(variants, 'wholesale', {
    includeSoldOut: product.status === 'COMING_SOON',
  });
  const { price, compareAt, discount, active: saleActive } = channelSaleDisplay(
    product.sale,
    product.wholesalePrice,
  );
  const showPrice = price > 0;
  const orderBadge = resolveWholesaleOrderBadge(product);
  const primaryImage = mediaUrl(product.images?.[0]);
  const secondImage = mediaUrl(product.images?.[1]);
  const sizeLabel = sizeTypeLabel(product.sizeType);
  const specParts = [
    product.fabric || null,
    sizeLabel || null,
    colors.length ? `${colors.length.toLocaleString('fa-IR')} رنگ` : null,
  ].filter(Boolean);

  // Never nest the quick-order dialog inside this article: hover:-translate creates a
  // fixed containing block, and mouseleave drops it so the overlay jumps to the viewport.
  return (
    <>
    <article
      className={`tn-card group relative flex h-full flex-col overflow-hidden rounded-lg bg-white focus-within:shadow-[0_4px_16px_rgba(27,92,74,0.07)] focus-within:ring-2 focus-within:ring-[var(--brand-gold,#C9A84C)] focus-within:ring-offset-2 ${
        orderOpen ? 'shadow-[0_4px_16px_rgba(27,92,74,0.07)]' : ''
      }`}
    >
      <Link
        href={href}
        prefetch
        onPointerEnter={() => warmProductRoute(href, (path) => router.prefetch(path))}
        onTouchStart={() => warmProductRoute(href, (path) => router.prefetch(path))}
        onClick={(event) => {
          onSelect();
          beginProductTransition(event, () => router.push(href));
        }}
        onLoad={(event) => {
          if ((event.target as HTMLElement).tagName === 'IMG') setImageReady(true);
        }}
        className={`tn-media relative block aspect-[3/4] overflow-hidden bg-[var(--brand-card,#F3EEE6)] focus:outline-none ${primaryImage && !imageReady ? 'tn-media-pending' : ''}`}
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
              quality={CATALOG_CARD_IMAGE_QUALITY}
              sizes={CATALOG_CARD_IMAGE_SIZES}
              className="tn-card-img object-cover object-center"
            />
            {secondImage ? (
              <Image
                src={secondImage}
                alt=""
                aria-hidden
                fill
                loading="lazy"
                fetchPriority="low"
                quality={CATALOG_CARD_IMAGE_QUALITY}
                sizes={CATALOG_CARD_IMAGE_SIZES}
                className="tn-card-img tn-card-alt hidden object-cover object-center opacity-0 md:block motion-reduce:hidden"
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
                  ? 'bg-[var(--brand-gold,#C9A84C)] text-[var(--brand-ink,#1A1A1A)]'
                  : 'bg-[var(--brand-ink,#1A1A1A)] text-white'
            }`}
          >
            {isAvailable ? 'آماده سفارش' : isComingSoon ? 'به‌زودی' : 'ناموجود'}
          </span>
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-3.5 sm:p-4">
        <div className="mb-1.5 flex items-center justify-between gap-2 text-[10px] text-[var(--brand-muted,#4B5563)]">
          <span className="font-mono tracking-wide" dir="ltr">
            {product.sku || 'TARANOM'}
          </span>
          {saleActive && discount ? (
            <span className="font-bold text-[var(--brand-gold-700,#836A27)]">
              ٪{discount.toLocaleString('fa-IR')} تخفیف
            </span>
          ) : null}
        </div>

        <Link
          href={href}
          prefetch={false}
          onClick={onSelect}
          className="rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-gold,#C9A84C)]"
        >
          <h3 className="line-clamp-2 min-h-10 text-sm font-bold leading-5 text-[var(--brand-ink,#1A1A1A)]">
            {product.name}
          </h3>
        </Link>

        {specParts.length ? (
          <p className="mt-2 text-[11px] leading-5 text-[var(--brand-muted,#4B5563)]">
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
              <p className="text-xs text-[var(--brand-muted,#4B5563)]">قیمت همکاری هر عدد</p>
              <p className="mt-0.5 text-base font-black text-[var(--brand-green,#1B5C4A)]">
                {showPrice ? `${toman(price)} تومان` : 'تماس بگیرید'}
              </p>
              {showPrice && saleActive && compareAt > price ? (
                <p className="text-[11px] text-[var(--brand-muted,#4B5563)] line-through">
                  {toman(compareAt)}
                </p>
              ) : null}
            </div>
            <span className="inline-flex min-w-0 max-w-[58%] shrink items-center rounded-full bg-[var(--brand-green,#1B5C4A)]/10 px-2.5 py-1 text-[10px] font-bold leading-4 text-[var(--brand-green,#1B5C4A)]">
              <span className="truncate">{orderBadge}</span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              trackWholesaleLead('wholesale_cta_click', {
                cta_location: 'catalog_quick_order',
                item_id: product.sku || product.id,
              });
              setOrderOpen(true);
            }}
            aria-label={`سفارش سریع ${product.name}`}
            className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-lg bg-[var(--brand-green,#1B5C4A)] px-3 text-xs font-bold text-white transition hover:bg-[var(--brand-green-dark,#0F2F28)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-gold,#C9A84C)]"
          >
            سفارش
            <ArrowLeft className="mr-1 h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </div>

    </article>
    <WholesaleQuickOrder product={product} open={orderOpen} onClose={() => setOrderOpen(false)} />
    </>
  );
}
