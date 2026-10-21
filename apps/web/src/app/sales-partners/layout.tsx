import { GoogleAnalyticsProvider } from '@/components/shared/GoogleAnalyticsProvider';

export default function SalesPartnersLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <GoogleAnalyticsProvider channel="WHOLESALE" />
    </>
  );
}
