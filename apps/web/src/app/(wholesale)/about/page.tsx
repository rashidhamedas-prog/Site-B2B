import type { Metadata } from 'next';
import { CmsPage } from '@/components/cms/CmsPage';

export const metadata: Metadata = {
  title: 'درباره ما',
  description:
    'ترنم از مشهد شروع شد؛ هنوز هم دوخت، کنترل کیفیت و پخش عمده را خودمان انجام می‌دهیم. اینجا داستان کارگاه و تیم‌مان را می‌خوانید.',
  alternates: { canonical: 'https://poshaktaranom.com/about' },
  openGraph: {
    title: 'درباره پوشاک ترنم',
    description: 'تولیدی مانتو زنانه در مشهد — از الگو تا ارسال عمده.',
    url: 'https://poshaktaranom.com/about',
  },
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-atmosphere">
      <CmsPage channel="WHOLESALE" pageKey="about" />
    </div>
  );
}
