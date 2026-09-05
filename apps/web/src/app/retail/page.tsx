import type { Metadata } from 'next';
import { CmsPage } from '@/components/cms/CmsPage';

/** Anonymous home HTML is public; 60s ISR. Cart/account/checkout stay dynamic via their own trees. */
export const revalidate = 60;
export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'پوشاک ترنم | خرید تکی پوشاک زنانه مشهد',
  description:
    'از کارگاه ترنم در مشهد می‌توانید شومیز، کت، کاپشن و کفتان را تکی بخرید. ارسال از همان تولیدی؛ تعویض سایز از حساب کاربری.',
  alternates: { canonical: 'https://www.poshaktaranom.ir' },
  openGraph: {
    title: 'پوشاک ترنم | خرید تکی پوشاک زنانه مشهد',
    description: 'خرید تکی از کارگاه مشهد — شومیز، کت، کاپشن و کفتان؛ نه سفارش پک بوتیک.',
    url: 'https://www.poshaktaranom.ir',
    images: [{ url: '/og-retail.jpg', width: 1200, height: 630, alt: 'پوشاک ترنم — خرید تکی' }],
  },
};

export default function RetailHomePage() {
  return <CmsPage channel="RETAIL" pageKey="home" />;
}
