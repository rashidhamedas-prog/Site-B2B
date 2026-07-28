import type { Metadata } from 'next';
import { CmsPage } from '@/components/cms/CmsPage';

export const metadata: Metadata = {
  title: 'تماس با فروشگاه',
  description:
    'سوالی درباره سفارش تکی دارید؟ با ترنم در تماس باشید: ۰۹۱۵۲۴۲۴۶۲۴ — مشهد، پاساژ کیمیا.',
  alternates: { canonical: 'https://www.poshaktaranom.ir/contact' },
};

export default function RetailContactPage() {
  return <CmsPage channel="RETAIL" pageKey="contact" />;
}
