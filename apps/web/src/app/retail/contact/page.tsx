import { CmsPage } from '@/components/cms/CmsPage';
import { metadataForCmsPage } from '@/lib/cms/fetch';
import { RETAIL_ORIGIN } from '@/lib/seo-origins';

export const revalidate = 60;

export async function generateMetadata() {
  return metadataForCmsPage('RETAIL', 'contact', {
    title: 'تماس با فروشگاه',
    description:
      'سوالی درباره سفارش تکی دارید؟ با ترنم در تماس باشید: ۰۹۱۵۲۴۲۴۶۲۴ — مشهد، پاساژ کیمیا.',
    canonical: `${RETAIL_ORIGIN}/contact`,
  });
}

export default function RetailContactPage() {
  return <CmsPage channel="RETAIL" pageKey="contact" />;
}
