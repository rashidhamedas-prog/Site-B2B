import type { Viewport } from 'next';
import { GoogleAnalyticsProvider } from '@/components/shared/GoogleAnalyticsProvider';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: '#1B5C4A',
};

export default function SalesPartnersLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <GoogleAnalyticsProvider channel="WHOLESALE" />
    </>
  );
}
