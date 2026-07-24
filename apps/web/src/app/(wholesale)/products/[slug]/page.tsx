import type { Metadata } from 'next';
import { ProductDetail } from '@/components/wholesale/ProductDetail';
import { WHOLESALE_ORIGIN } from '@/lib/seo';

interface Props {
  params: Promise<{ slug: string }>;
}

async function fetchProductMeta(slug: string) {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1';
    const res = await fetch(`${apiUrl}/products/slug/${encodeURIComponent(slug)}`, {
      next: { revalidate: 120 },
    });
    if (!res.ok) return null;
    return res.json() as Promise<{
      name?: string;
      description?: string;
      images?: string[];
      seoMeta?: {
        title?: string;
        description?: string;
        canonical?: string;
      };
    }>;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await fetchProductMeta(slug);
  const title = product?.seoMeta?.title || product?.name || slug.replace(/-/g, ' ');
  const description =
    product?.seoMeta?.description ||
    product?.description?.slice(0, 160) ||
    `مشخصات، رنگ‌بندی و حداقل سفارش عمده «${title}» مستقیم از تولیدی ترنم مشهد.`;
  const canonical = product?.seoMeta?.canonical || `${WHOLESALE_ORIGIN}/products/${slug}`;
  const image = product?.images?.[0];

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
  return <ProductDetail slug={slug} />;
}
