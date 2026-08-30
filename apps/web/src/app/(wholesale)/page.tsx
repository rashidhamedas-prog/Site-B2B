import type { Metadata } from 'next';
import { CmsPage } from '@/components/cms/CmsPage';

/** Anonymous home HTML is public; 60s ISR. Cart/account/checkout stay dynamic via their own trees. */
export const revalidate = 60;
export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'فروش عمده مانتو زنانه از تولیدی مشهد',
  description:
    'اگر بوتیک یا فروشگاه دارید، مانتو و شومیز لینن و کتان را مستقیم از کارگاه ترنم سفارش دهید. حداقل سفارش منطقی، ارسال به سراسر ایران.',
  alternates: { canonical: 'https://poshaktaranom.com' },
  openGraph: {
    title: 'فروش عمده مانتو زنانه | پوشاک ترنم مشهد',
    description: 'دوخت داخل کارگاه خودمان — عمده برای بوتیک‌ها، بدون واسطه.',
    url: 'https://poshaktaranom.com',
    siteName: 'پوشاک ترنم',
    locale: 'fa_IR',
    type: 'website',
    images: [{ url: '/og-wholesale.jpg', width: 1200, height: 630, alt: 'پوشاک ترنم' }],
  },
};

export default function HomePage() {
  return <CmsPage channel="WHOLESALE" pageKey="home" />;
}
