import type { Metadata } from 'next';
import { RetailHeader } from '@/components/retail/RetailHeader';
import { RetailFooter } from '@/components/retail/RetailFooter';
import './retail.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://www.poshaktaranom.ir'),
  title: {
    default: 'فروشگاه پوشاک ترنم | خرید آنلاین مانتو',
    template: '%s | فروشگاه ترنم',
  },
  description:
    'خرید آنلاین مانتو و پوشاک زنانه از تولیدی ترنم مشهد. ارسال سریع، پرداخت امن، تعویض سایز.',
  alternates: {
    canonical: 'https://www.poshaktaranom.ir',
  },
  openGraph: {
    type: 'website',
    locale: 'fa_IR',
    url: 'https://www.poshaktaranom.ir',
    siteName: 'فروشگاه پوشاک ترنم',
    title: 'فروشگاه پوشاک ترنم',
    description: 'خرید تکی مانتو لینن و کتان — مستقیم از تولیدی',
  },
  robots: { index: true, follow: true },
};

export default function RetailLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="retail-root flex min-h-screen flex-col bg-[var(--retail-bg)] text-[var(--retail-ink)]">
      <RetailHeader />
      <main className="flex-1">{children}</main>
      <RetailFooter />
    </div>
  );
}
