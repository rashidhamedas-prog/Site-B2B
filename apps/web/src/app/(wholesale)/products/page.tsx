import { CmsPageIntro } from '@/components/cms/CmsPageIntro';
import { WholesaleProductsCatalogWithUrl } from '@/components/wholesale/WholesaleProductsCatalogWithUrl';
import { metadataForCmsPage } from '@/lib/cms/fetch';
import { fetchProductList } from '@/lib/server-api';
import { WHOLESALE_ORIGIN } from '@/lib/seo-origins';
import { slimWholesaleCatalogProduct } from '@/lib/slim-wholesale-catalog';

/** Unfiltered /products is public ISR. Filters stay a client overlay + noindex. */
export const revalidate = 60;
export const dynamic = 'force-static';

export async function generateMetadata() {
  return metadataForCmsPage('WHOLESALE', 'products', {
    title: 'کاتالوگ عمده مانتو و شومیز',
    description:
      'همه مدل‌های جاری ترنم را ببینید، با پارچه و رنگ فیلتر کنید و برای بوتیک‌تان عمده سفارش دهید.',
    canonical: `${WHOLESALE_ORIGIN}/products`,
  });
}

export default async function ProductsPage() {
  const initial = await fetchProductList({
    channel: 'WHOLESALE',
    limit: 24,
    page: 1,
    status: 'ACTIVE',
    sort: 'newest',
  });

  return (
    <>
      <CmsPageIntro channel="WHOLESALE" pageKey="products" />
      <WholesaleProductsCatalogWithUrl
        initialProducts={initial.data.map((row) =>
          slimWholesaleCatalogProduct(row as Record<string, unknown>),
        )}
        initialTotal={initial.meta.total}
      />
    </>
  );
}
