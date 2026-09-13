import { CmsPage } from '@/components/cms/CmsPage';
import { metadataForCmsPage } from '@/lib/cms/fetch';
import { WHOLESALE_ORIGIN } from '@/lib/seo-origins';

export const revalidate = 60;

export async function generateMetadata() {
  return metadataForCmsPage('WHOLESALE', 'shipping', {
    title: 'شرایط ارسال عمده',
    description:
      'نحوه بسته‌بندی، زمان آماده‌سازی و گزینه‌های ارسال سفارش عمده ترنم به شهرهای مختلف ایران.',
    canonical: `${WHOLESALE_ORIGIN}/shipping`,
  });
}

export default function ShippingPage() {
  return (
    <div className="min-h-screen bg-atmosphere">
      <CmsPage channel="WHOLESALE" pageKey="shipping" />
    </div>
  );
}
