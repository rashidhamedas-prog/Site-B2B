import type { Metadata } from 'next';
import { PartnerLoginForm } from '@/components/partners/PartnerLoginForm';

export const metadata: Metadata = {
  title: 'ورود همکار | ترنم',
  robots: { index: false, follow: false },
};

export default function PartnerLoginPage() {
  return <PartnerLoginForm />;
}
