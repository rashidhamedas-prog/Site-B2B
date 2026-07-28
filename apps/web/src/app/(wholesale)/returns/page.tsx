import type { Metadata } from 'next';
import { CmsPage } from '@/components/cms/CmsPage';

export const metadata: Metadata = {
  title: 'شرایط مرجوعی عمده',
  description:
    'اگر ایراد دوخت یا مغایرت سفارش عمده داشتید، شرایط مرجوعی و تعویض ترنم را اینجا بخوانید.',
  alternates: { canonical: 'https://poshaktaranom.com/returns' },
};

export default function ReturnsPage() {
  return (
    <div className="min-h-screen bg-atmosphere">
      <CmsPage channel="WHOLESALE" pageKey="returns" />
    </div>
  );
}
