import type { Metadata } from 'next';
import { ProductJsonLd, BreadcrumbJsonLd } from '@/components/shared/JsonLd';
import { RetailProductDetail } from '@/components/retail/RetailProductDetail';
import { RETAIL_ORIGIN } from '@/lib/seo';
import { notFound } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1';

async function getProduct(slug: string) {
  try {
    const res = await fetch(`${API_BASE}/products/slug/${slug}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return { title: 'محصول' };

  const title = product.seoMeta?.title || product.name;
  const description =
    product.seoMeta?.description ||
    product.description?.slice(0, 160) ||
    `خرید تکی «${product.name}» از فروشگاه ترنم — مستقیم از تولیدی مشهد.`;
  const canonical = product.seoMeta?.canonical || `${RETAIL_ORIGIN}/products/${slug}`;
  const image = product.images?.[0];

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
  const product = await getProduct(slug);
  if (!product) notFound();

  const url = `${RETAIL_ORIGIN}/products/${slug}`;
  const price = Number(product.retailPrice ?? 0);
  const inStock = Number(product.stock ?? 0) > 0;

  return (
    <>
      <ProductJsonLd
        channel="RETAIL"
        name={product.name}
        description={product.description}
        image={product.images?.[0]}
        sku={product.sku}
        price={price}
        availability={inStock ? 'InStock' : 'OutOfStock'}
        fabric={product.fabric || product.specs?.fabricType}
        url={url}
      />
      <BreadcrumbJsonLd
        items={[
          { name: 'خانه', url: `${RETAIL_ORIGIN}/` },
          { name: 'محصولات', url: `${RETAIL_ORIGIN}/products` },
          { name: product.name, url },
        ]}
      />
      <RetailProductDetail product={product} />
    </>
  );
}
