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
      title: `عمده ${label}`,
      description: `مدل‌های ${label} را برای بوتیک‌تان فیلتر کنید و مستقیم از کارگاه ترنم سفارش دهید.`,
      alternates: { canonical: 'https://poshaktaranom.com/products' },
    };
  }
  return {
    title: 'کاتالوگ عمده مانتو و شومیز',
    description:
      'همه مدل‌های جاری ترنم را ببینید، با پارچه و رنگ فیلتر کنید و برای بوتیک‌تان عمده سفارش دهید.',
    alternates: { canonical: 'https://poshaktaranom.com/products' },
  };
}

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  return <ProductCatalog searchParams={params} />;
}
