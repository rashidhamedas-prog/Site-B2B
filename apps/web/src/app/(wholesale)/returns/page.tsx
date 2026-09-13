import { CmsPage } from '@/components/cms/CmsPage';
import { metadataForCmsPage } from '@/lib/cms/fetch';
import { WHOLESALE_ORIGIN } from '@/lib/seo-origins';

export const revalidate = 60;

export async function generateMetadata() {
  return metadataForCmsPage('WHOLESALE', 'returns', {
    title: 'شرایط مرجوعی عمده',
    description:
      'اگر ایراد دوخت یا مغایرت سفارش عمده داشتید، شرایط مرجوعی و تعویض ترنم را اینجا بخوانید.',
    canonical: `${WHOLESALE_ORIGIN}/returns`,
  });
}

export default function ReturnsPage() {
  return (
    <div className="min-h-screen bg-atmosphere">
      <CmsPage channel="WHOLESALE" pageKey="returns" />
    </div>
  );
}
