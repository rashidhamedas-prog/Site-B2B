import type { Metadata } from 'next';
import { ProductJsonLd, BreadcrumbJsonLd } from '@/components/shared/JsonLd';
import { RetailProductDetail } from '@/components/retail/RetailProductDetail';
import { RETAIL_ORIGIN } from '@/lib/seo';
import { fetchProductBySlug } from '@/lib/server-api';
import { notFound, permanentRedirect } from 'next/navigation';

type SeoBag = Record<string, string | undefined>;

function retailSeo(product: Record<string, unknown>) {
  const seo = (product.seoMeta ?? {}) as SeoBag;
  const title =
    seo.retailTitle || seo.title || (product.name as string) || 'محصول';
  const description =
    seo.retailDescription ||
    seo.description ||
    (typeof product.description === 'string' ? product.description.slice(0, 160) : '') ||
    `خرید تکی «${product.name}» از فروشگاه ترنم — مستقیم از تولیدی مشهد.`;
  const canonical =
    seo.retailCanonical ||
    seo.canonical ||
    `${RETAIL_ORIGIN}/products/${product.slug ?? ''}`;
  return { title, description, canonical, focusKeyword: seo.retailFocusKeyword || seo.focusKeyword };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await fetchProductBySlug(slug, 'RETAIL');
  if (!product) return { title: 'محصول' };

  const { title, description, canonical } = retailSeo(product);
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
        : [{ url: '/og-retail.jpg', width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: image ? [image] : ['/og-retail.jpg'],
    },
  };
}

export default async function RetailProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await fetchProductBySlug(slug, 'RETAIL');
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

  const url = `${RETAIL_ORIGIN}/products/${canonicalSlug}`;
  const price = Number(product.retailPrice ?? 0);
  const inStock =
    Number(product.totalStock ?? product.retailStock ?? product.stock ?? 0) > 0 ||
    ((product.variants as Array<{ retailStock?: number; stock?: number }>) ?? []).some(
      (v) => Number(v.retailStock ?? v.stock ?? 0) > 0,
    );

  return (
    <>
      <ProductJsonLd
        channel="RETAIL"
        name={String(product.name ?? '')}
        description={product.description as string | undefined}
        image={(product.images as string[] | undefined)?.[0]}
        sku={product.sku as string | undefined}
        price={price}
        availability={inStock ? 'InStock' : 'OutOfStock'}
        fabric={
          (product.fabric as string | undefined) ||
          ((product.specs as { fabricType?: string } | undefined)?.fabricType)
        }
        url={url}
      />
      <BreadcrumbJsonLd
        items={[
          { name: 'خانه', url: `${RETAIL_ORIGIN}/` },
          { name: 'محصولات', url: `${RETAIL_ORIGIN}/products` },
          { name: String(product.name ?? ''), url },
        ]}
      />
      <RetailProductDetail product={product as any} />
    </>
  );
}
