import type { Metadata } from 'next';
import { CmsPage } from '@/components/cms/CmsPage';

/** Anonymous home HTML is public; 60s ISR. Cart/account/checkout stay dynamic via their own trees. */
export const revalidate = 60;
export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'خرید آنلاین مانتو زنانه',
  description:
    'مانتو و شومیز را تکی، مستقیم از کارگاه ترنم در مشهد بخرید. ارسال سریع، پرداخت امن، تعویض سایز.',
  alternates: { canonical: 'https://www.poshaktaranom.ir' },
  openGraph: {
    title: 'فروشگاه پوشاک ترنم',
    description: 'استایل روزمره با دوخت کارگاهی — خرید تکی بدون واسطه.',
    url: 'https://www.poshaktaranom.ir',
    images: [{ url: '/og-retail.jpg', width: 1200, height: 630, alt: 'فروشگاه پوشاک ترنم' }],
  },
};

export default function RetailHomePage() {
  return <CmsPage channel="RETAIL" pageKey="home" />;
}
