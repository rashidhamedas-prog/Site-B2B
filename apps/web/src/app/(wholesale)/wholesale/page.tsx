import type { Metadata } from 'next';
import { CmsPage } from '@/components/cms/CmsPage';

export const metadata: Metadata = {
  title: 'شرایط همکاری عمده',
  description:
    'حداقل سفارش، نحوه ثبت‌نام بوتیک، پرداخت و ارسال — قوانین همکاری عمده با تولیدی ترنم مشهد.',
  alternates: { canonical: 'https://poshaktaranom.com/wholesale' },
  openGraph: {
    title: 'شرایط عمده‌فروشی پوشاک ترنم',
    description: 'همکاری مستقیم با تولیدی مانتو زنانه در مشهد.',
    url: 'https://poshaktaranom.com/wholesale',
  },
};

export default function WholesalePage() {
  return (
    <div className="min-h-screen bg-atmosphere">
      <CmsPage channel="WHOLESALE" pageKey="wholesale" />
    </div>
  );
}
