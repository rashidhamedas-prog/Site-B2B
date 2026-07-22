import type { Metadata } from 'next';
import { ProductCatalog } from '@/components/wholesale/ProductCatalog';

interface SearchParams {
  fabric?: string;
  color?: string;
  size?: string;
  sort?: string;
  page?: string;
  q?: string;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const params = await searchParams;
  const bits = [params.fabric, params.color, params.size].filter(Boolean);
  if (bits.length) {
    const label = bits.join(' · ');
    return {
      title: `عمده شومیزی زنانه ${label} | تولیدی ترنم مشهد`,
      description: `خرید عمده شومیزی و مانتو با فیلتر ${label} مستقیم از تولیدی ترنم.`,
      alternates: { canonical: 'https://poshaktaranom.com/products' },
    };
  }
  return {
    title: 'کاتالوگ محصولات | پوشاک ترنم',
    description: 'مشاهده تمام مدل‌های مانتو شومیزی زنانه ترنم. فیلتر بر اساس پارچه، رنگ و سایز.',
    alternates: { canonical: 'https://poshaktaranom.com/products' },
  };
}

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  return <ProductCatalog searchParams={params} />;
}
