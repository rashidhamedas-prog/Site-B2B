import type { Metadata } from 'next';
import { CmsPageIntro } from '@/components/cms/CmsPageIntro';
import { WholesaleProductsCatalogWithUrl } from '@/components/wholesale/WholesaleProductsCatalogWithUrl';
import { metadataForCmsPage } from '@/lib/cms/fetch';
import { fetchProductList } from '@/lib/server-api';
import { WHOLESALE_ORIGIN } from '@/lib/seo-origins';
import { slimWholesaleCatalogProduct } from '@/lib/slim-wholesale-catalog';
import {
  wholesaleCatalogQueryIsUtility,
  type WholesaleCatalogQuery,
} from '@/lib/wholesale-catalog-seo';

/** Clean /products stays ISR. Query variants resolve per-request for robots. */
export const revalidate = 60;

type ProductsSearchParams = Promise<WholesaleCatalogQuery>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: ProductsSearchParams;
}): Promise<Metadata> {
  const sp = await searchParams;
  const utility = wholesaleCatalogQueryIsUtility(sp);
  const base = await metadataForCmsPage('WHOLESALE', 'products', {
    title: 'کاتالوگ عمده مانتو و شومیز',
    description:
      'همه مدل‌های جاری ترنم را ببینید، با پارچه و رنگ فیلتر کنید و برای بوتیک‌تان عمده سفارش دهید.',
    canonical: `${WHOLESALE_ORIGIN}/products`,
  });
  if (!utility) return base;
  return {
    ...base,
    robots: { index: false, follow: true },
    alternates: { ...(base.alternates ?? {}), canonical: `${WHOLESALE_ORIGIN}/products` },
  };
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
