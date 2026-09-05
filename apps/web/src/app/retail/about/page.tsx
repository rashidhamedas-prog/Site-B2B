import type { Metadata } from 'next';
import { CmsPage } from '@/components/cms/CmsPage';

export const metadata: Metadata = {
  title: 'درباره پوشاک ترنم مشهد',
  description:
    'پوشاک ترنم در مشهد همان کارگاهی است که برای بوتیک‌ها هم می‌دوزد؛ این سایت فقط خرید تکی است.',
  alternates: { canonical: 'https://www.poshaktaranom.ir/about' },
};

export default function RetailAboutPage() {
  return <CmsPage channel="RETAIL" pageKey="about" />;
}
