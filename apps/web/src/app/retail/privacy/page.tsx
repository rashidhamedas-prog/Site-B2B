import { CmsPage } from '@/components/cms/CmsPage';
import { metadataForCmsPage } from '@/lib/cms/fetch';
import { RETAIL_ORIGIN } from '@/lib/seo-origins';

export const revalidate = 60;

export async function generateMetadata() {
  return metadataForCmsPage('RETAIL', 'privacy', {
    title: 'حریم خصوصی',
    description:
      'چطور اطلاعات تماس و سفارش شما را در فروشگاه تکی پوشاک ترنم نگه می‌داریم و استفاده می‌کنیم.',
    canonical: `${RETAIL_ORIGIN}/privacy`,
  });
}

export default function RetailPrivacyPage() {
  return <CmsPage channel="RETAIL" pageKey="privacy" />;
}
