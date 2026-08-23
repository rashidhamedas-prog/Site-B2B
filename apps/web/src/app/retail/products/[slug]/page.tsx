import type { Metadata } from 'next';
import { ProductJsonLd, ProductGroupJsonLd, BreadcrumbJsonLd } from '@/components/shared/JsonLd';
import { RetailProductDetail } from '@/components/retail/RetailProductDetail';
import { RetailPdpAnalytics } from '@/components/retail/RetailPdpAnalytics';
import { RETAIL_ORIGIN } from '@/lib/seo';
import { loadCanonicalStorefrontProduct } from '@/lib/load-canonical-storefront-product';
import { resolvePublicProductCanonical } from '@/lib/public-product-path';
import { getProductCanonicalPath } from '@/lib/canonical-urls';

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
  const resolved = resolvePublicProductCanonical({
    productSlug: String(product.slug || ''),
    customCanonical: seo.retailCanonical || seo.canonical || null,
    origin: RETAIL_ORIGIN,
    onInvalid: (reason) => {
      console.warn('[publicProductPath]', product.slug, reason);
    },
  });
  return { title, description, canonical: resolved.url, focusKeyword: seo.retailFocusKeyword || seo.focusKeyword };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await loadCanonicalStorefrontProduct(slug, 'RETAIL');

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
  const product = await loadCanonicalStorefrontProduct(slug, 'RETAIL');
  const canonicalSlug = String(product.slug || '');

  const url = `${RETAIL_ORIGIN}${getProductCanonicalPath(canonicalSlug)}`;
  const sale = product.sale as { active?: boolean; payable?: number } | undefined;
  // Expired sale: API payable is the list price, never the lapsed discount.
  const price = Number(sale?.payable ?? product.retailPrice ?? 0);
  const variants =
    (product.variants as Array<{ color?: string; size?: string; sku?: string; retailStock?: number; stock?: number }>) ??
    [];
  const inStock =
    Number(product.totalStock ?? product.retailStock ?? product.stock ?? 0) > 0 ||
    variants.some((v) => Number(v.retailStock ?? v.stock ?? 0) > 0);
  const availability = inStock ? 'InStock' : 'OutOfStock';
  const name = String(product.name ?? '');
  const description = (product.fullContent as string | undefined) || (product.description as string | undefined);
  const image = (product.images as string[] | undefined)?.[0];
  const fabric =
    (product.fabric as string | undefined) ||
    ((product.specs as { fabricType?: string } | undefined)?.fabricType);

  return (
    <>
      <ProductJsonLd
        channel="RETAIL"
        name={name}
        description={description}
        image={image}
        sku={product.sku as string | undefined}
        price={price}
        includePrice
        availability={availability}
        fabric={fabric}
        url={url}
      />
      <ProductGroupJsonLd
        channel="RETAIL"
        name={name}
        description={description}
        image={image}
        url={url}
        sku={product.sku as string | undefined}
        price={price}
        includePrice
        availability={availability}
        variants={variants}
      />
      <BreadcrumbJsonLd
        items={[
          { name: 'خانه', url: `${RETAIL_ORIGIN}/` },
          { name: 'محصولات', url: `${RETAIL_ORIGIN}/products` },
          { name, url },
        ]}
      />
      <RetailPdpAnalytics product={product as { id?: string; sku?: string; name?: string; retailPrice?: number | null; retailCompareAtPrice?: number | null; sale?: { payable?: number; original?: number | null }; fabric?: string | null }} />
      <RetailProductDetail product={product as any} />
    </>
  );
}
