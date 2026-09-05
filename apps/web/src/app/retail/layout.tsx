import type { Metadata } from 'next';
import { RetailHeader } from '@/components/retail/RetailHeader';
import { RetailFooter } from '@/components/retail/RetailFooter';
import { RetailPixels } from '@/components/retail/RetailPixels';
import { RetailAffiliateCapture } from '@/components/retail/RetailAffiliateCapture';
import {
  RetailChromeProvider,
  type RetailChromeBag,
  type RetailMarketingPublic,
} from '@/components/retail/RetailChromeProvider';
import { GoogleAnalyticsProvider } from '@/components/shared/GoogleAnalyticsProvider';
import { OrganizationJsonLd, WebSiteJsonLd } from '@/components/shared/JsonLd';
import { fetchSiteContent } from '@/lib/cms/fetch';
import { defaultSiteChrome, parseChromeBlocks } from '@/lib/cms/chrome';
import { fetchPublicSettings } from '@/lib/server-api';
import { normalizeEnamad, type EnamadSealConfig } from '@/lib/enamad';
import { resolveGscVerification } from '@/lib/google-seo';
import './retail.css';

const REVALIDATE = 120;

type PublicSettingsPayload = {
  business?: {
    enamadWholesale?: Partial<EnamadSealConfig>;
    enamadRetail?: Partial<EnamadSealConfig>;
  };
  marketing?: RetailMarketingPublic;
};

export async function generateMetadata(): Promise<Metadata> {
  const google = await resolveGscVerification('RETAIL');
  return {
    metadataBase: new URL('https://www.poshaktaranom.ir'),
    title: {
      default: 'فروشگاه پوشاک ترنم | خرید آنلاین مانتو',
      template: '%s | فروشگاه ترنم',
    },
    description:
      'مانتو و شومیز را تکی، مستقیم از تولیدی ترنم در مشهد بخرید. ارسال سریع، پرداخت امن و امکان تعویض سایز.',
    // NOTE: no layout-level canonical — a default here would make every page
    // without its own canonical claim the homepage URL (soft-duplicate signal).
    openGraph: {
      type: 'website',
      locale: 'fa_IR',
      url: 'https://www.poshaktaranom.ir',
      siteName: 'فروشگاه پوشاک ترنم',
      title: 'فروشگاه پوشاک ترنم | خرید آنلاین مانتو',
      description: 'خرید تکی مانتو لینن و کتان — همان کارگاهی که برای بوتیک‌ها هم می‌دوزد.',
      images: [{ url: '/og-retail.jpg', width: 1200, height: 630, alt: 'فروشگاه پوشاک ترنم' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'فروشگاه پوشاک ترنم',
      description: 'خرید تکی مانتو و شومیز از تولیدی مشهد',
      images: ['/og-retail.jpg'],
    },
    robots: { index: true, follow: true },
    ...(google ? { verification: { google } } : {}),
  };
}

export default async function RetailLayout({ children }: { children: React.ReactNode }) {
  const [settings, chromeDoc] = await Promise.all([
    fetchPublicSettings<PublicSettingsPayload>('RETAIL'),
    fetchSiteContent('RETAIL', 'chrome', { revalidate: REVALIDATE }),
  ]);

  const chrome = chromeDoc?.blocks?.length
    ? parseChromeBlocks(chromeDoc.blocks)
    : defaultSiteChrome('RETAIL');

  const bag: RetailChromeBag = {
    chrome,
    enamad: settings?.business?.enamadRetail
      ? normalizeEnamad(settings.business.enamadRetail)
      : null,
    marketing: settings?.marketing ?? null,
  };

  return (
    <RetailChromeProvider value={bag}>
      <div className="retail-root flex min-h-screen min-w-0 flex-col overflow-x-clip bg-[var(--retail-bg)] text-[var(--retail-ink)]">
        <OrganizationJsonLd channel="RETAIL" />
        <WebSiteJsonLd channel="RETAIL" />
        <GoogleAnalyticsProvider channel="RETAIL" />
        <RetailPixels marketing={bag.marketing} />
        <RetailAffiliateCapture />
        <RetailHeader />
        <main className="min-w-0 flex-1 overflow-x-clip">{children}</main>
        <RetailFooter />
      </div>
    </RetailChromeProvider>
  );
}
