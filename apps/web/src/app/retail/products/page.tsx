import type { Metadata } from 'next';
import { RetailProductsCatalog } from '@/components/retail/RetailProductsCatalog';
import { fetchProductList } from '@/lib/server-api';

interface SearchParams {
  q?: string;
  search?: string;
  fabric?: string;
  color?: string;
  size?: string;
  collar?: string;
  collectionId?: string;
  category?: string;
  categoryId?: string;
  minPrice?: string;
  maxPrice?: string;
  page?: string;
  sort?: string;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const params = await searchParams;
  // Title/description/canonical come from the products layout. Search, filter
  // and pagination states must stay out of the index (canonical already points
  // to the clean /products URL) while product links remain followable.
  const isListingVariant = Boolean(
    params.q ||
      params.search ||
      params.fabric ||
      params.color ||
      params.size ||
      params.collar ||
      params.collectionId ||
      params.category ||
      params.categoryId ||
      params.minPrice ||
      params.maxPrice ||
      params.page ||
      params.sort,
  );
  return isListingVariant ? { robots: { index: false, follow: true } } : {};
}

export default async function RetailProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const isListingVariant = Boolean(
    params.q ||
      params.search ||
      params.fabric ||
      params.color ||
      params.size ||
      params.collar ||
      params.collectionId ||
      params.category ||
      params.categoryId ||
      params.minPrice ||
      params.maxPrice ||
      params.page ||
      params.sort,
  );

  const initial = isListingVariant
    ? null
    : await fetchProductList({
        channel: 'RETAIL',
        limit: 24,
        status: 'ACTIVE',
        sort: 'newest',
      });

  return (
    <RetailProductsCatalog
      searchParams={params}
      initialProducts={initial?.data}
      initialTotalPages={initial?.meta.totalPages}
      seedDefaultListing={!isListingVariant}
    />
  );
}
