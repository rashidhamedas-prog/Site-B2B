import type { Metadata } from 'next';
import { RetailHeader } from '@/components/retail/RetailHeader';
import { RetailFooter } from '@/components/retail/RetailFooter';
import { RetailPixels } from '@/components/retail/RetailPixels';
import { OrganizationJsonLd, WebSiteJsonLd } from '@/components/shared/JsonLd';
import './retail.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://www.poshaktaranom.ir'),
  title: {
    default: 'فروشگاه پوشاک ترنم | خرید آنلاین مانتو',
    template: '%s | فروشگاه ترنم',
  },
  description:
    'مانتو و شومیز را تکی، مستقیم از تولیدی ترنم در مشهد بخرید. ارسال سریع، پرداخت امن و امکان تعویض سایز.',
  alternates: {
    canonical: 'https://www.poshaktaranom.ir',
  },
  openGraph: {
    type: 'website',
    locale: 'fa_IR',
    url: 'https://www.poshaktaranom.ir',
    siteName: 'فروشگاه پوشاک ترنم',
    title: 'فروشگاه پوشاک ترنم | خرید آنلاین مانتو',
    description: 'خرید تکی مانتو لینن و کتان — همان کارگاهی که برای بوتیک‌ها هم می‌دوزد.',
    images: [{ url: '/og-retail.jpg', width: 1200, height: 630, alt: 'فروشگاه پوشاک ترنم' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'فروشگاه پوشاک ترنم',
    description: 'خرید تکی مانتو و شومیز از تولیدی مشهد',
    images: ['/og-retail.jpg'],
  },
  robots: { index: true, follow: true },
};

export default function RetailLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="retail-root flex min-h-screen flex-col bg-[var(--retail-bg)] text-[var(--retail-ink)]">
      <OrganizationJsonLd channel="RETAIL" />
      <WebSiteJsonLd channel="RETAIL" />
      <RetailPixels />
      <RetailHeader />
      <main className="flex-1">{children}</main>
      <RetailFooter />
    </div>
  );
}
