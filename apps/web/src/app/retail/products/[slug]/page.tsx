import type { Metadata } from 'next';
import { ProductJsonLd, ProductGroupJsonLd, BreadcrumbJsonLd } from '@/components/shared/JsonLd';
import { RetailProductDetail } from '@/components/retail/RetailProductDetail';
import { RetailPdpAnalytics } from '@/components/retail/RetailPdpAnalytics';
import { RETAIL_ORIGIN } from '@/lib/seo';
import { loadCanonicalStorefrontProduct } from '@/lib/load-canonical-storefront-product';
import { resolvePublicProductCanonical } from '@/lib/public-product-path';
import { getProductCanonicalPath } from '@/lib/canonical-urls';
import { resolveRetailPdpOption, torobHeadMeta } from '@/lib/torob-pdp-meta';
import { resolveRetailProductSeo } from '@/lib/retail-seo-copy';

type SeoBag = Record<string, string | undefined>;

function retailSeo(product: Record<string, unknown>) {
  const seo = (product.seoMeta ?? {}) as SeoBag;
  const copy = resolveRetailProductSeo({
    slug: String(product.slug || ''),
    name: String(product.name || ''),
    seo,
    description: typeof product.description === 'string' ? product.description : null,
  });
  const resolved = resolvePublicProductCanonical({
    productSlug: String(product.slug || ''),
    customCanonical: seo.retailCanonical || seo.canonical || null,
    origin: RETAIL_ORIGIN,
    onInvalid: (reason) => {
      console.warn('[publicProductPath]', product.slug, reason);
    },
  });
  return { title: copy.title, description: copy.description, canonical: resolved.url, focusKeyword: copy.focusKeyword };
}

function absUrl(url?: string | null) {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url.replace(/^http:\/\//i, 'https://');
  if (url.startsWith('/')) return `${RETAIL_ORIGIN}${url}`;
  return url;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ variant?: string | string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const query = searchParams ? await searchParams : {};
  const requested = Array.isArray(query.variant) ? query.variant[0] : query.variant;
  const product = await loadCanonicalStorefrontProduct(slug, 'RETAIL');
  const option = resolveRetailPdpOption(product as any, requested);
  const { title, description, canonical } = retailSeo(product);
  const image = absUrl(option.image || (product.images as string[] | undefined)?.[0]);

  return {
    title,
    description,
    alternates: { canonical },
    other: torobHeadMeta(option),
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
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ variant?: string | string[] }>;
}) {
  const { slug } = await params;
  const query = searchParams ? await searchParams : {};
  const requested = Array.isArray(query.variant) ? query.variant[0] : query.variant;
  const product = await loadCanonicalStorefrontProduct(slug, 'RETAIL');
  const option = resolveRetailPdpOption(product as any, requested);
  const canonicalSlug = String(product.slug || '');

  const url = `${RETAIL_ORIGIN}${getProductCanonicalPath(canonicalSlug)}`;
  const sale = product.sale as { active?: boolean; payable?: number } | undefined;
  const price = Number(sale?.payable ?? product.retailPrice ?? 0);
  const variants =
    (product.variants as Array<{ id?: string; color?: string; size?: string; sku?: string; retailStock?: number; stock?: number }>) ??
    [];
  const inStock = option.availability === 'instock';
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
      <section className="sr-only" aria-label="مشخصات محصول برای خزش">
        <h1>{name}</h1>
        <p>قیمت: {option.productPriceToman} تومان</p>
        <p>موجودی: {option.availability === 'instock' ? 'موجود' : 'ناموجود'}</p>
        {option.optionLabel ? <p>گزینه: {option.optionLabel}</p> : null}
      </section>
      <RetailPdpAnalytics product={product as { id?: string; sku?: string; name?: string; retailPrice?: number | null; retailCompareAtPrice?: number | null; sale?: { payable?: number; original?: number | null }; fabric?: string | null }} />
      <RetailProductDetail
        product={product as any}
        initialVariantId={option.selected?.id}
      />
    </>
  );
}
