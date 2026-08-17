import type { Metadata } from 'next';
import { WholesaleAboutView } from '@/components/wholesale/WholesaleAboutView';
import { WHOLESALE_ORIGIN } from '@/lib/seo-origins';

export const metadata: Metadata = {
  title: 'درباره تولیدی پوشاک ترنم',
  description:
    'تولید مانتو و پوشاک زنانه اسپرت در مشهد؛ از انتخاب پارچه و برش تا دوخت، کنترل کیفیت و فروش مستقیم.',
  alternates: { canonical: `${WHOLESALE_ORIGIN}/about` },
  openGraph: {
    title: 'درباره تولیدی پوشاک ترنم',
    description:
      'تولید مانتو و پوشاک زنانه اسپرت در مشهد؛ از انتخاب پارچه و برش تا دوخت، کنترل کیفیت و فروش مستقیم.',
    url: `${WHOLESALE_ORIGIN}/about`,
  },
};

export default function AboutPage() {
  return <WholesaleAboutView />;
}
