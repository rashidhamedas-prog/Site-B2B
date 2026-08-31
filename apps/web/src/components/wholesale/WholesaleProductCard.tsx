'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { ProductImage } from '@/components/ui/ProductImage';
import { getToken } from '@/lib/auth';
import { channelSaleDisplay, sizeTypeLabel, toman, uniqueByColor } from '@/lib/product-display';
import { WholesaleQuickOrder } from './WholesaleQuickOrder';

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
  sizeType?: string;
  minOrderQty?: number;
  minimumOrderQuantity?: number;
  allowWholesaleColorSelect?: boolean;
  minWholesaleColors?: number;
  variants?: Array<{ color?: string; colorHex?: string; stock?: number; wholesaleStock?: number; size?: string }>;
};

export function WholesaleProductCard({ product }: { product: WholesaleCardProduct }) {
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

  useEffect(() => {
    setSignedIn(Boolean(getToken()));
  }, []);

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-lg border border-[var(--brand-border,#E8E0D4)] bg-[var(--brand-ivory,#F6F1E8)] transition duration-300 hover:border-[var(--brand-gold,#C9A84C)] focus-within:ring-2 focus-within:ring-[var(--brand-gold,#C9A84C)] focus-within:ring-offset-2 motion-reduce:transition-none">
      <Link href={href} className="relative block aspect-[3/4] overflow-hidden bg-[var(--brand-card,#F3EEE6)] focus:outline-none">
        <ProductImage
          src={product.images?.[0]}
          alt={product.name}
          sizes="(max-width:640px) 50vw, (max-width:1024px) 33vw, 25vw"
        />
        <div className="absolute right-3 top-3 flex flex-wrap gap-1.5">
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
          {saleActive && discount ? (
            <span className="rounded-sm bg-[var(--brand-gold,#C9A84C)] px-2.5 py-1 text-[10px] font-bold text-[var(--brand-green-dark,#0F2F28)]">
              ٪{discount.toLocaleString('fa-IR')} تخفیف
            </span>
          ) : null}
          {product.fabric ? (
            <span className="rounded-sm bg-white/90 px-2.5 py-1 text-[10px] font-semibold text-[var(--brand-green-dark,#0F2F28)]">
              {product.fabric}
            </span>
          ) : null}
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-3.5 sm:p-4">
        <div className="mb-2 flex items-center justify-between gap-2 text-[10px] text-[var(--brand-muted,#6B7280)]">
          <span className="font-mono tracking-wide" dir="ltr">
            {product.sku || 'TARANOM'}
          </span>
          <span>{sizeTypeLabel(product.sizeType)}</span>
        </div>
        <Link href={href} className="rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-gold,#C9A84C)]">
          <h3 className="line-clamp-2 min-h-10 text-sm font-bold leading-5 text-[var(--brand-ink,#1A1A1A)]">
            {product.name}
          </h3>
        </Link>

        <div className="mt-3 flex min-h-7 items-center justify-between gap-2 border-y border-dashed border-[var(--brand-border,#E8E0D4)] py-2">
          <div className="flex -space-x-1 space-x-reverse" aria-label={`${colors.length.toLocaleString('fa-IR')} رنگ`}>
            {colors.slice(0, 5).map((variant) => (
              <span
                key={variant.color}
                className="h-5 w-5 rounded-full border-2 border-white ring-1 ring-black/10"
                style={{ backgroundColor: variant.colorHex || '#d6d3d1' }}
                title={variant.color}
              />
            ))}
          </div>
          <span className="text-[11px] font-medium text-[var(--brand-muted,#6B7280)]">
            {colors.length ? `${colors.length.toLocaleString('fa-IR')} رنگ` : 'رنگ‌بندی در جزئیات'}
            {' · '}
            {sizeTypeLabel(product.sizeType)}
          </span>
        </div>

        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          <div>
            <p className="text-[10px] text-[var(--brand-muted,#6B7280)]">قیمت همکاری هر عدد</p>
            <p className="mt-0.5 text-base font-black text-[var(--brand-green,#1B5C4A)]">
              {showPrice ? `${toman(price)} تومان` : 'پس از ورود'}
            </p>
            {showPrice && saleActive && compareAt > price ? (
              <p className="text-[11px] text-[var(--brand-muted,#6B7280)] line-through">{toman(compareAt)}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setOrderOpen(true)}
            aria-label={`سفارش سریع ${product.name}`}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--brand-green,#1B5C4A)] px-3 text-xs font-bold text-white transition hover:bg-[var(--brand-green-dark,#0F2F28)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-gold,#C9A84C)]"
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
