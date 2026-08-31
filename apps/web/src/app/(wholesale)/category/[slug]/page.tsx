import { Suspense } from 'react';
import type { Metadata } from 'next';
import {
  CategoryLanding,
  categoryLandingMetadata,
} from '@/components/category/CategoryLanding';
import { CategoryQueryOverlay } from '@/components/category/CategoryQueryOverlay';

/** Unfiltered /category/{slug} is public HTML; query filters stay a client overlay. */
export const revalidate = 60;
export const dynamic = 'force-static';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return categoryLandingMetadata('WHOLESALE', slug, {});
}

export default async function WholesaleCategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <>
      <CategoryLanding channel="WHOLESALE" slug={slug} searchParams={{}} />
      <Suspense fallback={null}>
        <CategoryQueryOverlay channel="WHOLESALE" slug={slug} />
      </Suspense>
    </>
  );
}
