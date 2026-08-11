import type { Metadata } from 'next';
import { ProductDetail, type WholesaleProduct } from '@/components/wholesale/ProductDetail';
import { ProductJsonLd, BreadcrumbJsonLd } from '@/components/shared/JsonLd';
import { WHOLESALE_ORIGIN } from '@/lib/seo';
import { fetchProductBySlug } from '@/lib/server-api';
import { notFound, permanentRedirect } from 'next/navigation';
import { resolvePublicProductCanonical } from '@/lib/public-product-path';

interface Props {
  params: Promise<{ slug: string }>;
}

type SeoBag = Record<string, string | undefined>;

function wholesaleSeo(product: Record<string, unknown>) {
  const seo = (product.seoMeta ?? {}) as SeoBag;
  const title =
    seo.wholesaleTitle || seo.title || (product.name as string) || 'محصول';
  const description =
    seo.wholesaleDescription ||
    seo.description ||
    (typeof product.description === 'string' ? product.description.slice(0, 160) : '') ||
    `مشخصات، رنگ‌بندی و حداقل سفارش عمده «${title}» مستقیم از تولیدی ترنم مشهد.`;
  const resolved = resolvePublicProductCanonical({
    productSlug: String(product.slug || ''),
    customCanonical: seo.wholesaleCanonical || seo.canonical || null,
    origin: WHOLESALE_ORIGIN,
    onInvalid: (reason) => {
      console.warn('[publicProductPath:wholesale]', product.slug, reason);
    },
  });
  return { title, description, canonical: resolved.url };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await fetchProductBySlug(slug, 'WHOLESALE');
  // notFound() here (not only in the page) so the response is a real 404:
  // metadata resolves before the streaming shell (loading.tsx) flushes 200.
  if (!product) notFound();
  const { title, description, canonical } = wholesaleSeo(product);
  const image = (product.images as string[] | undefined)?.[0];

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: 'website',
      locale: 'fa_IR',
      images: image
        ? [{ url: image, alt: title }]
        : [{ url: '/og-wholesale.jpg', width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: image ? [image] : ['/og-wholesale.jpg'],
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await fetchProductBySlug(slug, 'WHOLESALE');
  if (!product) notFound();

  const canonicalSlug = String(product.slug || '');
  let incoming = slug;
  try {
    incoming = decodeURIComponent(slug);
  } catch {
    /* keep */
  }
  if (canonicalSlug && incoming !== canonicalSlug) {
    permanentRedirect(`/products/${canonicalSlug}`);
  }

  const url = `${WHOLESALE_ORIGIN}/products/${canonicalSlug}`;
  const variants =
    (product.variants as Array<{ color?: string; stock?: number; wholesaleStock?: number }>) ?? [];
  const totalStock =
    typeof product.wholesaleStock === 'number'
      ? Number(product.wholesaleStock)
      : typeof product.totalStock === 'number'
        ? Number(product.totalStock)
        : typeof product.stock === 'number'
          ? Number(product.stock)
          : variants.reduce(
              (sum, v) => sum + (Number(v.wholesaleStock) || Number(v.stock) || 0),
              0,
            );
  const isComingSoon = product.status === 'COMING_SOON';
  const fabricLabel =
    (product.fabric as string | undefined) ||
    ((product.specs as { fabricType?: string } | undefined)?.fabricType);

  return (
    <>
      <ProductJsonLd
        channel="WHOLESALE"
        name={String(product.name ?? '')}
        description={(product.description as string | undefined) || fabricLabel}
        image={(product.images as string[] | undefined)?.[0]}
        sku={product.sku as string | undefined}
        price={Number(product.wholesalePrice ?? 0)}
        availability={totalStock > 0 ? 'InStock' : isComingSoon ? 'PreOrder' : 'OutOfStock'}
        fabric={fabricLabel}
        color={variants.find((v) => v.color)?.color}
        moq={Number(product.minOrderQty ?? 0) || undefined}
        url={url}
      />
      <BreadcrumbJsonLd
        items={[
          { name: 'خانه', url: `${WHOLESALE_ORIGIN}/` },
          { name: 'محصولات', url: `${WHOLESALE_ORIGIN}/products` },
          { name: String(product.name ?? ''), url },
        ]}
      />
      <ProductDetail
        slug={canonicalSlug || slug}
        initialProduct={product as unknown as WholesaleProduct}
      />
    </>
  );
}
