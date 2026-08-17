import type { Metadata } from 'next';
import {
  CategoryLanding,
  categoryLandingMetadata,
  type CategorySearchParams,
} from '@/components/category/CategoryLanding';

export const revalidate = 300;

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<CategorySearchParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  return categoryLandingMetadata('RETAIL', slug, await searchParams);
}

export default async function RetailCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<CategorySearchParams>;
}) {
  const { slug } = await params;
  return (
    <CategoryLanding
      channel="RETAIL"
      slug={slug}
      searchParams={await searchParams}
    />
  );
}
