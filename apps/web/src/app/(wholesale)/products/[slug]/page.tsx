import type { Metadata } from 'next';
import { ProductDetail } from '@/components/wholesale/ProductDetail';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `${slug.replace(/-/g, ' ')} | پوشاک ترنم`,
    description: 'مشاهده مشخصات، رنگ‌بندی و موجودی محصول',
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  return <ProductDetail slug={slug} />;
}
