import { CmsPage } from '@/components/cms/CmsPage';
import { metadataForCmsPage } from '@/lib/cms/fetch';
import { RETAIL_ORIGIN } from '@/lib/seo-origins';

export const revalidate = 60;

export async function generateMetadata() {
  return metadataForCmsPage('RETAIL', 'shipping', {
    title: 'ارسال سفارش',
    description:
      'گزینه‌های ارسال فروشگاه ترنم: پست پیشتاز، تیپاکس، چاپار و پیک تهران — زمان تقریبی و پوشش شهرها.',
    canonical: `${RETAIL_ORIGIN}/shipping`,
  });
}

export default function RetailShippingPage() {
  return <CmsPage channel="RETAIL" pageKey="shipping" title="ارسال سفارش" />;
}
