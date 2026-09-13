import { CmsPage } from '@/components/cms/CmsPage';
import { metadataForCmsPage } from '@/lib/cms/fetch';
import { WHOLESALE_ORIGIN } from '@/lib/seo-origins';

export const revalidate = 60;

export async function generateMetadata() {
  return metadataForCmsPage('WHOLESALE', 'terms', {
    title: 'قوانین و مقررات',
    description: 'قوانین استفاده از سایت و سفارش عمده پوشاک ترنم؛ شفاف و کوتاه.',
    canonical: `${WHOLESALE_ORIGIN}/terms`,
  });
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-atmosphere">
      <CmsPage channel="WHOLESALE" pageKey="terms" />
    </div>
  );
}
