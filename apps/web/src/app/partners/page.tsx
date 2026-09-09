import type { Metadata } from 'next';
import { PartnerHome } from '@/components/partners/PartnerHome';

export const metadata: Metadata = {
  title: 'پنل همکار | ترنم',
  robots: { index: false, follow: false },
};

export default function PartnersHomePage() {
  return <PartnerHome />;
}
