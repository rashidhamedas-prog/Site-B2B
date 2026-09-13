import { CmsPage } from '@/components/cms/CmsPage';
import { metadataForCmsPage } from '@/lib/cms/fetch';
import { WHOLESALE_ORIGIN } from '@/lib/seo-origins';

export const revalidate = 60;

export async function generateMetadata() {
  return metadataForCmsPage('WHOLESALE', 'contact', {
    title: 'تماس با ما',
    description:
      'برای سفارش عمده یا بازدید از دفتر پخش مشهد با حامد رشید تماس بگیرید: ۰۹۱۵۲۴۲۴۶۲۴ — پاساژ کیمیا، میدان ۱۷ شهریور.',
    canonical: `${WHOLESALE_ORIGIN}/contact`,
  });
}

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-atmosphere">
      <CmsPage channel="WHOLESALE" pageKey="contact" />
    </div>
  );
}
