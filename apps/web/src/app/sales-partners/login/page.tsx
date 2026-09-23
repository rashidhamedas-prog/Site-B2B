import type { Metadata } from 'next';
import { SalesPartnerLoginForm } from '@/components/sales-partners/SalesPartnerLoginForm';

export const metadata: Metadata = {
  title: 'ورود همکار بازاریاب',
  robots: { index: false, follow: false },
};

export default function SalesPartnerLoginPage() {
  return <SalesPartnerLoginForm />;
}
