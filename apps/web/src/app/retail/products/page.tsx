import { RetailProductsCatalogWithUrl } from '@/components/retail/RetailProductsCatalogWithUrl';
import { fetchProductList, slimRetailCatalogProduct } from '@/lib/server-api';

/** Default listing is public ISR. Filters and page>1 stay a client overlay. */
export const revalidate = 60;
export const dynamic = 'force-static';

export default async function RetailProductsPage() {
  const initial = await fetchProductList({
    channel: 'RETAIL',
    limit: 24,
    page: 1,
    status: 'ACTIVE',
    sort: 'newest',
  });

  return (
    <RetailProductsCatalogWithUrl
      initialProducts={initial.data.map((row) =>
        slimRetailCatalogProduct(row as Record<string, unknown>),
      )}
      initialTotalPages={initial.meta.totalPages}
    />
  );
}
