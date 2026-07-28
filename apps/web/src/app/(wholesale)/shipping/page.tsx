import type { Metadata } from 'next';
import { CmsPage } from '@/components/cms/CmsPage';

export const metadata: Metadata = {
  title: 'شرایط ارسال عمده',
  description:
    'نحوه بسته‌بندی، زمان آماده‌سازی و گزینه‌های ارسال سفارش عمده ترنم به شهرهای مختلف ایران.',
  alternates: { canonical: 'https://poshaktaranom.com/shipping' },
};

export default function ShippingPage() {
  return (
    <div className="min-h-screen bg-atmosphere">
      <CmsPage channel="WHOLESALE" pageKey="shipping" />
    </div>
  );
}
