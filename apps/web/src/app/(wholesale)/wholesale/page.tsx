import { CmsPage } from '@/components/cms/CmsPage';
import { metadataForCmsPage } from '@/lib/cms/fetch';
import { WHOLESALE_ORIGIN } from '@/lib/seo-origins';

export const revalidate = 60;

export async function generateMetadata() {
  return metadataForCmsPage('WHOLESALE', 'wholesale', {
    title: 'شرایط همکاری عمده',
    description:
      'حداقل سفارش، نحوه ثبت‌نام بوتیک، پرداخت و ارسال — قوانین همکاری عمده با تولیدی ترنم مشهد.',
    canonical: `${WHOLESALE_ORIGIN}/wholesale`,
  });
}

export default function WholesalePage() {
  return (
    <div className="min-h-screen bg-atmosphere">
      <CmsPage channel="WHOLESALE" pageKey="wholesale" />
    </div>
  );
}
