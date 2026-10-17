import type { Metadata } from 'next';
import { CmsPageIntro } from '@/components/cms/CmsPageIntro';
import { WholesaleProductsCatalogWithUrl } from '@/components/wholesale/WholesaleProductsCatalogWithUrl';
import { metadataForCmsPage } from '@/lib/cms/fetch';
import { fetchProductList } from '@/lib/server-api';
import { WHOLESALE_ORIGIN } from '@/lib/seo-origins';
import { slimWholesaleCatalogProduct } from '@/lib/slim-wholesale-catalog';
import { fetchStorefrontCategories } from '@/lib/catalog/fetch-storefront-categories';
import {
  toWholesaleCategoryTiles,
  WholesaleCategoryIndexView,
} from '@/components/wholesale/WholesaleCategoryIndex';

/**
 * Clean /products stays ISR (mirror retail). Filtered / page>1 URLs are a
 * client overlay that already emits robots noindex — do not read searchParams
 * here or the route becomes dynamic and cold TTFB regresses.
 */
export const revalidate = 60;
export const dynamic = 'force-static';

export async function generateMetadata(): Promise<Metadata> {
  return metadataForCmsPage('WHOLESALE', 'products', {
    title: 'کاتالوگ عمده مانتو و شومیز',
    description:
      'همه مدل‌های جاری ترنم را ببینید، با پارچه و رنگ فیلتر کنید و برای بوتیک‌تان عمده سفارش دهید.',
    canonical: `${WHOLESALE_ORIGIN}/products`,
  });
}

export default async function ProductsPage() {
  const [initial, categoryRows] = await Promise.all([
    fetchProductList({
      channel: 'WHOLESALE',
      limit: 24,
      page: 1,
      status: 'ACTIVE',
      sort: 'newest',
    }),
    fetchStorefrontCategories(),
  ]);
  const categoryTiles = toWholesaleCategoryTiles(categoryRows);

  return (
    <>
      <CmsPageIntro channel="WHOLESALE" pageKey="products" />
      <WholesaleCategoryIndexView items={categoryTiles} showThumbs={false} body="" />
      <WholesaleProductsCatalogWithUrl
        initialProducts={initial.data.map((row) =>
          slimWholesaleCatalogProduct(row as Record<string, unknown>),
        )}
        initialTotal={initial.meta.total}
        initialTotalPages={initial.meta.totalPages}
      />
    </>
  );
}
