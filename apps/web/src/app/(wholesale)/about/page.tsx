import { CmsPageIntro } from '@/components/cms/CmsPageIntro';
import { WholesaleAboutView } from '@/components/wholesale/WholesaleAboutView';
import { metadataForCmsPage } from '@/lib/cms/fetch';
import { WHOLESALE_ORIGIN } from '@/lib/seo-origins';

export const revalidate = 60;

export async function generateMetadata() {
  return metadataForCmsPage('WHOLESALE', 'about', {
    title: 'تولیدی مانتو در مشهد',
    description:
      'پوشاک ترنم در مشهد مانتو و شومیز را در کارگاه خودش می‌دوزد و به بوتیک‌ها عمده می‌فروشد؛ از انتخاب پارچه تا دفتر پخش پاساژ کیمیا.',
    canonical: `${WHOLESALE_ORIGIN}/about`,
  });
}

export default function AboutPage() {
  return (
    <>
      <CmsPageIntro channel="WHOLESALE" pageKey="about" storedOnly />
      <WholesaleAboutView />
    </>
  );
}
