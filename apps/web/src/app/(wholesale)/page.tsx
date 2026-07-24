import type { Metadata } from 'next';
import { HeroSection } from '@/components/wholesale/HeroSection';
import { WhyTaranom } from '@/components/wholesale/WhyTaranom';
import { FeaturedProducts } from '@/components/wholesale/FeaturedProducts';
import { ComingSoonSection } from '@/components/wholesale/ComingSoonSection';
import { HowItWorks } from '@/components/wholesale/HowItWorks';
import { WholesaleStats } from '@/components/wholesale/WholesaleStats';
import { Testimonials } from '@/components/wholesale/Testimonials';
import { WholesaleFaq } from '@/components/wholesale/WholesaleFaq';
import { CtaBanner } from '@/components/wholesale/CtaBanner';

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
  return (
    <>
      <HeroSection />
      <WholesaleStats />
      <WhyTaranom />
      <FeaturedProducts />
      <ComingSoonSection />
      <HowItWorks />
      <Testimonials />
      <WholesaleFaq />
      <CtaBanner />
    </>
  );
}
