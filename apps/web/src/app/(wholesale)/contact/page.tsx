import type { Metadata } from 'next';
import { CmsPage } from '@/components/cms/CmsPage';

export const metadata: Metadata = {
  title: 'تماس با ما',
  description:
    'برای سفارش عمده یا بازدید از دفتر پخش مشهد با حامد رشید تماس بگیرید: ۰۹۱۵۲۴۲۴۶۲۴ — پاساژ کیمیا، میدان ۱۷ شهریور.',
  alternates: { canonical: 'https://poshaktaranom.com/contact' },
  openGraph: {
    title: 'تماس با پوشاک ترنم',
    description: 'دفتر پخش مشهد و راه‌های ارتباطی برای عمده‌فروشان.',
    url: 'https://poshaktaranom.com/contact',
  },
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-atmosphere">
      <CmsPage channel="WHOLESALE" pageKey="contact" />
    </div>
  );
}
