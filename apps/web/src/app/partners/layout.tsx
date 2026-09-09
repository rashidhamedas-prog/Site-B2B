import type { Metadata } from 'next';
import { PartnerShell } from '@/components/partners/PartnerShell';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function PartnersLayout({ children }: { children: React.ReactNode }) {
  return <PartnerShell>{children}</PartnerShell>;
}
