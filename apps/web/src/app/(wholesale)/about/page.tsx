import type { Metadata } from 'next';
import { WholesaleAboutView } from '@/components/wholesale/WholesaleAboutView';
import { WHOLESALE_ORIGIN } from '@/lib/seo-origins';

export const metadata: Metadata = {
  title: 'درباره ما | تولیدی پوشاک ترنم',
  description:
    'ترنم همراه فروشندگان پوشاک در مشهد است؛ از انتخاب پارچه و برش تا دوخت، کنترل کیفیت و فروش عمده به بوتیک.',
  alternates: { canonical: `${WHOLESALE_ORIGIN}/about` },
  openGraph: {
    title: 'درباره ما | تولیدی پوشاک ترنم',
    description:
      'ترنم همراه فروشندگان پوشاک در مشهد است؛ از انتخاب پارچه و برش تا دوخت، کنترل کیفیت و فروش عمده به بوتیک.',
    url: `${WHOLESALE_ORIGIN}/about`,
  },
};

export default function AboutPage() {
  return <WholesaleAboutView />;
}
