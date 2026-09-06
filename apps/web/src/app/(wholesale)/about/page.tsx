import type { Metadata } from 'next';
import { WholesaleAboutView } from '@/components/wholesale/WholesaleAboutView';
import { WHOLESALE_ORIGIN } from '@/lib/seo-origins';

export const metadata: Metadata = {
  title: 'تولیدی مانتو در مشهد',
  description:
    'پوشاک ترنم در مشهد مانتو و شومیز را در کارگاه خودش می‌دوزد و به بوتیک‌ها عمده می‌فروشد؛ از انتخاب پارچه تا دفتر پخش پاساژ کیمیا.',
  alternates: { canonical: `${WHOLESALE_ORIGIN}/about` },
  openGraph: {
    title: 'تولیدی مانتو در مشهد',
    description:
      'کارگاه و دفتر پخش در مشهد؛ همکاری عمده با بوتیک‌ها، حداقل سفارش هر مدل از ۶ عدد.',
    url: `${WHOLESALE_ORIGIN}/about`,
  },
};

export default function AboutPage() {
  return <WholesaleAboutView />;
}
