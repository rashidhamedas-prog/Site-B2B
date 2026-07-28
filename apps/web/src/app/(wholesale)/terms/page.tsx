import type { Metadata } from 'next';
import { CmsPage } from '@/components/cms/CmsPage';

export const metadata: Metadata = {
  title: 'قوانین و مقررات',
  description: 'قوانین استفاده از سایت و سفارش عمده پوشاک ترنم؛ شفاف و کوتاه.',
  alternates: { canonical: 'https://poshaktaranom.com/terms' },
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-atmosphere">
      <CmsPage channel="WHOLESALE" pageKey="terms" />
    </div>
  );
}
