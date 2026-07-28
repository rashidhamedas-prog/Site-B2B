import type { Metadata } from 'next';
import { CmsPage } from '@/components/cms/CmsPage';

export const metadata: Metadata = {
  title: 'درباره فروشگاه ترنم',
  description:
    'ترنم در مشهد مانتو می‌دوزد؛ این فروشگاه همان کیفیت کارگاه را برای خرید تکی شما می‌آورد.',
  alternates: { canonical: 'https://www.poshaktaranom.ir/about' },
};

export default function RetailAboutPage() {
  return <CmsPage channel="RETAIL" pageKey="about" />;
}
