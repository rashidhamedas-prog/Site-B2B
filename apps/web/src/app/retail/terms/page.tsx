import { CmsPage } from '@/components/cms/CmsPage';
import { metadataForCmsPage } from '@/lib/cms/fetch';
import { RETAIL_ORIGIN } from '@/lib/seo-origins';

export const revalidate = 60;

export async function generateMetadata() {
  return metadataForCmsPage('RETAIL', 'terms', {
    title: 'شرایط و قوانین',
    description: 'شرایط خرید تکی از پوشاک ترنم؛ سفارش، ارسال، مرجوعی و قیمت فروشگاه.',
    canonical: `${RETAIL_ORIGIN}/terms`,
  });
}

export default function RetailTermsPage() {
  return <CmsPage channel="RETAIL" pageKey="terms" />;
}
