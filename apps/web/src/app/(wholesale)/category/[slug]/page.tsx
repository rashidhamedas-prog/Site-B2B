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
  return categoryLandingMetadata('WHOLESALE', slug, await searchParams);
}

export default async function WholesaleCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<CategorySearchParams>;
}) {
  const { slug } = await params;
  return (
    <CategoryLanding
      channel="WHOLESALE"
      slug={slug}
      searchParams={await searchParams}
    />
  );
}
