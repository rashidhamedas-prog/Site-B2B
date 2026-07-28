import type { Metadata } from 'next';
import { CmsPage } from '@/components/cms/CmsPage';

export const metadata: Metadata = {
  title: 'ارسال سفارش',
  description:
    'گزینه‌های ارسال فروشگاه ترنم: پست پیشتاز، تیپاکس، چاپار و پیک تهران — زمان تقریبی و پوشش شهرها.',
  alternates: { canonical: 'https://www.poshaktaranom.ir/shipping' },
};

export default function RetailShippingPage() {
  return <CmsPage channel="RETAIL" pageKey="shipping" />;
}
