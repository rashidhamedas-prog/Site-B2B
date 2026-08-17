import type { Metadata } from 'next';
import { permanentRedirect } from 'next/navigation';
import { ProductCatalog } from '@/components/wholesale/ProductCatalog';
import { fetchPublicCategories } from '@/components/category/CategoryLanding';
import { fetchProductList } from '@/lib/server-api';

interface SearchParams {
  fabric?: string;
  color?: string;
  size?: string;
  sort?: string;
  page?: string;
  q?: string;
  categoryId?: string;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const params = await searchParams;
  const bits = [params.fabric, params.color, params.size].filter(Boolean);
  // Search/filter/pagination states: keep them out of the index (canonical stays
  // on the clean listing URL); crawlers may still follow product links.
  const isListingVariant = Boolean(
    params.q || params.sort || params.page || params.categoryId || bits.length,
  );
  const robots = isListingVariant
    ? ({ index: false, follow: true } as const)
    : undefined;
  if (bits.length) {
    const label = bits.join(' · ');
    return {
      title: `عمده ${label}`,
      description: `مدل‌های ${label} را برای بوتیک‌تان فیلتر کنید و مستقیم از کارگاه ترنم سفارش دهید.`,
      alternates: { canonical: 'https://poshaktaranom.com/products' },
      ...(robots ? { robots } : {}),
    };
  }
  return {
    title: 'کاتالوگ عمده مانتو و شومیز',
    description:
      'همه مدل‌های جاری ترنم را ببینید، با پارچه و رنگ فیلتر کنید و برای بوتیک‌تان عمده سفارش دهید.',
    alternates: { canonical: 'https://poshaktaranom.com/products' },
    ...(robots ? { robots } : {}),
  };
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  if (params.categoryId) {
    const categories = await fetchPublicCategories();
    const match = categories.find((row) => row.id === params.categoryId && row.slug);
    if (match?.slug) {
      const qs = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (key === 'categoryId' || value == null || value === '') continue;
        qs.set(key, value);
      }
      const suffix = qs.toString() ? `?${qs.toString()}` : '';
      permanentRedirect(`/category/${match.slug}${suffix}`);
    }
  }

  const isListingVariant = Boolean(
    params.q ||
      params.sort ||
      params.page ||
      params.fabric ||
      params.color ||
      params.size ||
      params.categoryId,
  );

  // Clean /products: SSR first page so crawlers see product links in HTML.
  // Filtered/query variants stay client-driven (and noindex,follow via metadata).
  const initial = isListingVariant
    ? null
    : await fetchProductList({
        channel: 'WHOLESALE',
        limit: 24,
        status: 'ACTIVE',
        sort: 'newest',
      });

  return (
    <ProductCatalog
      searchParams={{
        fabric: params.fabric,
        color: params.color,
        size: params.size,
        sort: params.sort,
        page: params.page,
        q: params.q,
      }}
      initialProducts={initial?.data}
      initialTotal={initial?.meta.total}
    />
  );
}
