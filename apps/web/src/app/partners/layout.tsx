import type { Metadata } from 'next';
import { PartnerShell } from '@/components/partners/PartnerShell';
import { GoogleAnalyticsProvider } from '@/components/shared/GoogleAnalyticsProvider';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function PartnersLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PartnerShell>{children}</PartnerShell>
      <GoogleAnalyticsProvider channel="WHOLESALE" />
    </>
  );
}
