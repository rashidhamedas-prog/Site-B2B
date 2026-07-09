import type { Metadata } from 'next';
import { ProductCatalog } from '@/components/wholesale/ProductCatalog';

export const metadata: Metadata = {
  title: 'کاتالوگ محصولات | پوشاک ترنم',
  description: 'مشاهده تمام مدل‌های مانتو شومیزی زنانه ترنم. فیلتر بر اساس پارچه، رنگ و سایز.',
  alternates: { canonical: 'https://poshaktaranom.com/products' },
};

interface SearchParams {
  fabric?: string;
  color?: string;
  size?: string;
  sort?: string;
  page?: string;
  q?: string;
}

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  return <ProductCatalog searchParams={params} />;
}
