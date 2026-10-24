import Image from 'next/image';
import Link from 'next/link';
import { RetailProductCard } from '@/components/retail/RetailProductCard';
import { mediaUrl, storefrontSizeLabels, uniqueInStockColors, variantsOnSizeChart } from '@/lib/product-display';
import { resolveProductImageAlt } from '@/lib/product-image-alt';
import {
  CATALOG_CARD_IMAGE_QUALITY,
  CATALOG_CARD_IMAGE_SIZES,
} from '@/lib/catalog-performance';
import type { CategoryChannel, CategoryProduct } from './category-search-params';

export function CategoryProductCard({
  product,
  channel,
}: {
  product: CategoryProduct;
  channel: CategoryChannel;
}) {
  const href = `/products/${product.slug}`;
  const image = mediaUrl(product.images?.[0]);
  const retail = channel === 'RETAIL';
  const chart = { sizeType: product.sizeType, sizeLabels: product.sizeLabels };
  const variants = variantsOnSizeChart(product.variants ?? [], chart);
  const colors = uniqueInStockColors(variants, retail ? 'retail' : 'wholesale', {
    includeSoldOut: retail && !!product.isPreOrder,
  });
  const sizes = storefrontSizeLabels(variants, chart, {
    channel: retail ? 'retail' : 'wholesale',
    includeSoldOut: retail && !!product.isPreOrder,
  });

  if (retail && product.id && product.slug) {
    return (
      <RetailProductCard
        compact
        product={{
          id: product.id,
          name: product.name || '',
          slug: product.slug,
          fabric: product.fabric,
          retailPrice: product.retailPrice,
          retailStock: typeof product.retailStock === 'number' ? product.retailStock : undefined,
          isPreOrder: product.isPreOrder,
          images: product.images,
          imageAlts: product.imageAlts,
          sale: product.sale,
          sizeType: product.sizeType,
          sizeLabels: product.sizeLabels ?? undefined,
          variants: product.variants?.map((v) => ({
            color: v.color,
            colorHex: v.colorHex,
            size: v.size,
            retailStock: typeof v.retailStock === 'number' ? v.retailStock : undefined,
          })),
        }}
      />
    );
  }

  return (
    <article className="tn-card group overflow-hidden rounded-lg border border-[var(--brand-border,#E8E0D4)] bg-[var(--brand-ivory,#F6F1E8)]">
      <Link href={href} className="tn-media relative block aspect-[3/4] overflow-hidden bg-[var(--brand-card,#F3EEE6)]">
        {image ? (
          <Image
            src={image}
            alt={resolveProductImageAlt(product.imageAlts, product.images?.[0], { name: product.name, fabric: product.fabric, index: 0 })}
            fill
            quality={CATALOG_CARD_IMAGE_QUALITY}
            sizes={CATALOG_CARD_IMAGE_SIZES}
            className="tn-card-img object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[var(--brand-muted,#6B7280)]">
            بدون تصویر
          </div>
        )}
      </Link>
      <div className="p-3.5 sm:p-4">
        <Link href={href} className="block text-sm font-bold leading-6 text-[var(--brand-ink,#1A1A1A)]">
          {product.name}
        </Link>
        {product.fabric ? (
          <p className="mt-1 text-xs text-[var(--brand-muted,#6B7280)]">{product.fabric}</p>
        ) : null}
        {colors.length || sizes.length ? (
          <div className="mt-2 space-y-1.5 text-xs text-[var(--brand-muted,#6B7280)]">
            {colors.length ? (
              <p>
                رنگ‌ها:{' '}
                {colors
                  .map((c) => c.color)
                  .filter(Boolean)
                  .slice(0, 6)
                  .join('، ')}
              </p>
            ) : null}
            {sizes.length ? <p>سایزها: {sizes.slice(0, 8).join('، ')}</p> : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
