import { CmsPageIntro } from '@/components/cms/CmsPageIntro';
import { RetailProductsCatalogWithUrl } from '@/components/retail/RetailProductsCatalogWithUrl';
import { metadataForCmsPage } from '@/lib/cms/fetch';
import { fetchProductList, slimRetailCatalogProduct } from '@/lib/server-api';
import { RETAIL_ORIGIN } from '@/lib/seo-origins';

/** Default listing is public ISR. Filters and page>1 stay a client overlay. */
export const revalidate = 60;
export const dynamic = 'force-static';

export async function generateMetadata() {
  return metadataForCmsPage('RETAIL', 'products', {
    title: 'خرید تکی پوشاک ترنم',
    description: 'شومیز، کت، کاپشن و کفتان از کارگاه مشهد — خرید تکی با ارسال به سراسر ایران.',
    canonical: `${RETAIL_ORIGIN}/products`,
  });
}

export default async function RetailProductsPage() {
  const initial = await fetchProductList({
    channel: 'RETAIL',
    limit: 24,
    page: 1,
    status: 'ACTIVE',
    sort: 'newest',
  });

  return (
    <>
      <CmsPageIntro channel="RETAIL" pageKey="products" />
      <RetailProductsCatalogWithUrl
        initialProducts={initial.data.map((row) =>
          slimRetailCatalogProduct(row as Record<string, unknown>),
        )}
        initialTotalPages={initial.meta.totalPages}
      />
    </>
  );
}
