import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ScrollToTop } from '@/components/shared/ScrollToTop';
import { ThemeRuntime } from '@/components/wholesale/ThemeRuntime';
import { OrganizationJsonLd, WebSiteJsonLd } from '@/components/shared/JsonLd';
import { GoogleAnalyticsProvider } from '@/components/shared/GoogleAnalyticsProvider';

export default function WholesaleLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <OrganizationJsonLd channel="WHOLESALE" />
      <WebSiteJsonLd channel="WHOLESALE" />
      <GoogleAnalyticsProvider channel="WHOLESALE" />
      <ThemeRuntime />
      <Header />
      <main>{children}</main>
      <Footer />
      <ScrollToTop />
    </>
  );
}
