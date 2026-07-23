import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RetailProductDetail } from '@/components/retail/RetailProductDetail';

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
  return {
    title: product.name,
    description: product.description?.slice(0, 160) || `خرید ${product.name} از فروشگاه ترنم`,
    alternates: { canonical: `https://www.poshaktaranom.ir/products/${slug}` },
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

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    sku: product.sku,
    image: product.images?.[0],
    offers: {
      '@type': 'Offer',
      priceCurrency: 'IRR',
      price: Number(product.retailPrice ?? 0),
      availability:
        Number(product.stock ?? 0) > 0
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
      url: `https://www.poshaktaranom.ir/products/${slug}`,
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <RetailProductDetail product={product} />
    </>
  );
}
