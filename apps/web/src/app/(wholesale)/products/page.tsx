import type { Metadata } from 'next';
import { WholesaleProductsCatalogWithUrl } from '@/components/wholesale/WholesaleProductsCatalogWithUrl';
import { fetchProductList } from '@/lib/server-api';
import { slimWholesaleCatalogProduct } from '@/lib/slim-wholesale-catalog';

/** Unfiltered /products is public ISR. Filters stay a client overlay + noindex. */
export const revalidate = 60;
export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'کاتالوگ عمده مانتو و شومیز',
  description:
    'همه مدل‌های جاری ترنم را ببینید، با پارچه و رنگ فیلتر کنید و برای بوتیک‌تان عمده سفارش دهید.',
  alternates: { canonical: 'https://poshaktaranom.com/products' },
};

export default async function ProductsPage() {
  const initial = await fetchProductList({
    channel: 'WHOLESALE',
    limit: 24,
    page: 1,
    status: 'ACTIVE',
    sort: 'newest',
  });

  return (
    <WholesaleProductsCatalogWithUrl
      initialProducts={initial.data.map((row) =>
        slimWholesaleCatalogProduct(row as Record<string, unknown>),
      )}
      initialTotal={initial.meta.total}
    />
  );
}
