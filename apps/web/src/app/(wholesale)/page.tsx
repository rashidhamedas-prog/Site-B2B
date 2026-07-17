import type { Metadata } from 'next';
import { HeroSection } from '@/components/wholesale/HeroSection';
import { WhyTaranom } from '@/components/wholesale/WhyTaranom';
import { FeaturedProducts } from '@/components/wholesale/FeaturedProducts';
import { ComingSoonSection } from '@/components/wholesale/ComingSoonSection';
import { HowItWorks } from '@/components/wholesale/HowItWorks';
import { WholesaleStats } from '@/components/wholesale/WholesaleStats';
import { CtaBanner } from '@/components/wholesale/CtaBanner';
import { Testimonials } from '@/components/wholesale/Testimonials';

export const metadata: Metadata = {
  title: 'فروش عمده مانتو زنانه | پوشاک ترنم مشهد',
  description:
    'خرید عمده مانتو شومیزی زنانه لینن و کتان از تولیدی ترنم مشهد. بیش از ۱۰ سال سابقه، حداقل سفارش ۵ عدد، ارسال به سراسر ایران.',
  alternates: { canonical: 'https://poshaktaranom.com' },
  openGraph: {
    title: 'فروش عمده مانتو زنانه | پوشاک ترنم مشهد',
    description: 'تولیدکننده مانتو شومیزی زنانه لینن و کتان — مستقیم از کارخانه به بوتیک شما',
    url: 'https://poshaktaranom.com',
    siteName: 'پوشاک ترنم',
    locale: 'fa_IR',
    type: 'website',
  },
};

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <WholesaleStats />
      <WhyTaranom />
      <FeaturedProducts />
      <ComingSoonSection />
      <Testimonials />
      <HowItWorks />
      <CtaBanner />
    </>
  );
}
