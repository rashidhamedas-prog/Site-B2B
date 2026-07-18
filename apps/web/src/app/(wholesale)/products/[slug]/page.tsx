import type { Metadata } from 'next';
import { ProductDetail } from '@/components/wholesale/ProductDetail';

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
      seoMeta?: Record<string, string>;
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
    product?.seoMeta?.description
    || product?.description
    || 'مشاهده مشخصات، رنگ‌بندی و موجودی محصول از تولیدی ترنم';
  return {
    title: `${title} | پوشاک ترنم`,
    description,
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  return <ProductDetail slug={slug} />;
}
