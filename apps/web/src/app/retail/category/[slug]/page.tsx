import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
  CategoryLanding,
  categoryLandingMetadata,
  fetchCategoryBySlug,
} from '@/components/category/CategoryLanding';
import { CategoryQueryOverlay } from '@/components/category/CategoryQueryOverlay';
import { redirectIfMatched } from '@/lib/seo-redirect';

/** Unfiltered /category/{slug} is public HTML; query filters stay a client overlay. */
export const revalidate = 60;
export const dynamic = 'force-static';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = await fetchCategoryBySlug(slug);
  if (!category) {
    await redirectIfMatched('RETAIL', `/category/${slug}`);
    notFound();
  }
  return categoryLandingMetadata('RETAIL', slug, {});
}

export default async function RetailCategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <>
      <CategoryLanding channel="RETAIL" slug={slug} searchParams={{}} />
      <Suspense fallback={null}>
        <CategoryQueryOverlay channel="RETAIL" slug={slug} />
      </Suspense>
    </>
  );
}
