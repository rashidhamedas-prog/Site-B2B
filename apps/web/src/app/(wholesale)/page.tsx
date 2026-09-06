import type { Metadata } from 'next';
import { CmsPage } from '@/components/cms/CmsPage';

/** Anonymous home HTML is public; 60s ISR. Cart/account/checkout stay dynamic via their own trees. */
export const revalidate = 60;
export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'تولیدی مانتو مشهد | خرید عمده',
  description:
    'اگر بوتیک دارید، مانتو و شومیز را مستقیم از کارگاه ترنم در مشهد سفارش دهید. حداقل سفارش هر مدل از ۶ عدد است؛ بعد از تأیید حساب، قیمت همکاری باز می‌شود.',
  alternates: { canonical: 'https://poshaktaranom.com' },
  openGraph: {
    title: 'تولیدی مانتو مشهد | پوشاک ترنم',
    description: 'خرید عمده از کارگاه مشهد — حداقل سفارش هر مدل از ۶ عدد.',
    url: 'https://poshaktaranom.com',
    siteName: 'پوشاک ترنم',
    locale: 'fa_IR',
    type: 'website',
    images: [{ url: '/og-wholesale.jpg', width: 1200, height: 630, alt: 'تولیدی مانتو مشهد — پوشاک ترنم' }],
  },
};

export default function HomePage() {
  return <CmsPage channel="WHOLESALE" pageKey="home" />;
}
