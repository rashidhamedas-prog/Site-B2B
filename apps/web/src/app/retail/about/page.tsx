import { CmsPage } from '@/components/cms/CmsPage';
import { metadataForCmsPage } from '@/lib/cms/fetch';
import { RETAIL_ORIGIN } from '@/lib/seo-origins';

export const revalidate = 60;

export async function generateMetadata() {
  return metadataForCmsPage('RETAIL', 'about', {
    title: 'درباره پوشاک ترنم مشهد',
    description:
      'پوشاک ترنم در مشهد همان کارگاهی است که برای بوتیک‌ها هم می‌دوزد؛ این سایت فقط خرید تکی است.',
    canonical: `${RETAIL_ORIGIN}/about`,
  });
}

export default function RetailAboutPage() {
  return <CmsPage channel="RETAIL" pageKey="about" title="درباره پوشاک ترنم مشهد" />;
}
