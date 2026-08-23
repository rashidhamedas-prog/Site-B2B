import type { Metadata } from 'next';
import { permanentRedirect } from 'next/navigation';
import { RetailProductsCatalog } from '@/components/retail/RetailProductsCatalog';
import { fetchPublicCategories } from '@/components/category/CategoryLanding';
import { fetchProductList, slimRetailCatalogProduct } from '@/lib/server-api';

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

/** Default listing is public; filtered views stay dynamic via searchParams. */
export const revalidate = 120;

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

function hasCatalogFilters(params: SearchParams): boolean {
  return Boolean(
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
      params.sort,
  );
}

function remainingProductQuery(params: SearchParams): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === 'categoryId' || value == null || value === '') continue;
    qs.set(key, value);
  }
  const raw = qs.toString();
  return raw ? `?${raw}` : '';
}

export default async function RetailProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  if (params.categoryId) {
    const categories = await fetchPublicCategories();
    const match = categories.find((row) => row.id === params.categoryId && row.slug);
    if (match?.slug) {
      permanentRedirect(`/category/${match.slug}${remainingProductQuery(params)}`);
    }
  }

  const filtered = hasCatalogFilters(params);
  const pageNum = Math.max(1, Math.floor(Number(params.page) || 1));

  const initial = filtered
    ? null
    : await fetchProductList({
        channel: 'RETAIL',
        limit: 24,
        page: pageNum,
        status: 'ACTIVE',
        sort: 'newest',
      });

  return (
    <RetailProductsCatalog
      searchParams={params}
      initialProducts={initial?.data.map((row) => slimRetailCatalogProduct(row as Record<string, unknown>))}
      initialTotalPages={initial?.meta.totalPages}
      initialPage={pageNum}
      seedDefaultListing={!filtered}
    />
  );
}
