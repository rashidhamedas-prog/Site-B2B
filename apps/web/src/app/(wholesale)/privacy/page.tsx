import type { Metadata } from 'next';
import { CmsPage } from '@/components/cms/CmsPage';

export const metadata: Metadata = {
  title: 'حریم خصوصی',
  description: 'چطور اطلاعات تماس و سفارش شما را در سایت پوشاک ترنم نگه می‌داریم و استفاده می‌کنیم.',
  alternates: { canonical: 'https://poshaktaranom.com/privacy' },
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-atmosphere">
      <CmsPage channel="WHOLESALE" pageKey="privacy" />
    </div>
  );
}
