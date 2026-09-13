import { CmsPage } from '@/components/cms/CmsPage';
import { metadataForCmsPage } from '@/lib/cms/fetch';
import { WHOLESALE_ORIGIN } from '@/lib/seo-origins';

export const revalidate = 60;

export async function generateMetadata() {
  return metadataForCmsPage('WHOLESALE', 'privacy', {
    title: 'حریم خصوصی',
    description: 'چطور اطلاعات تماس و سفارش شما را در سایت پوشاک ترنم نگه می‌داریم و استفاده می‌کنیم.',
    canonical: `${WHOLESALE_ORIGIN}/privacy`,
  });
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-atmosphere">
      <CmsPage channel="WHOLESALE" pageKey="privacy" />
    </div>
  );
}
