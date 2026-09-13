import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ScrollToTop } from '@/components/shared/ScrollToTop';
import { FloatingContact } from '@/components/shared/FloatingContact';
import { ThemeRuntime } from '@/components/wholesale/ThemeRuntime';
import {
  WholesaleChromeProvider,
  type WholesaleChromeBag,
} from '@/components/wholesale/WholesaleChromeProvider';
import { OrganizationJsonLd, WebSiteJsonLd } from '@/components/shared/JsonLd';
import { GoogleAnalyticsProvider } from '@/components/shared/GoogleAnalyticsProvider';
import { fetchSiteContent } from '@/lib/cms/fetch';
import { defaultSiteChrome, parseChromeBlocks } from '@/lib/cms/chrome';
import { DEFAULT_MENUS, type MenusSettings } from '@/lib/menus';
import { fetchPublicSettings } from '@/lib/server-api';
import { normalizeEnamad, type EnamadSealConfig } from '@/lib/enamad';
import { mergePublicTheme, type ThemeSettings } from '@/lib/theme-settings';
import { resolveGscVerification } from '@/lib/google-seo';
import {
  layoutSeoFromSettings,
  type PublicBusinessSettings,
  type PublicPaymentFlags,
  type PublicSeoSettings,
} from '@/lib/organization-from-settings';
import type { Metadata } from 'next';

const REVALIDATE = 120;

type PublicSettingsPayload = {
  theme?: ThemeSettings;
  menus?: MenusSettings;
  seo?: PublicSeoSettings;
  payment?: PublicPaymentFlags;
  business?: PublicBusinessSettings & {
    enamadWholesale?: Partial<EnamadSealConfig>;
    enamadRetail?: Partial<EnamadSealConfig>;
  };
};

export async function generateMetadata(): Promise<Metadata> {
  const [google, settings] = await Promise.all([
    resolveGscVerification('WHOLESALE'),
    fetchPublicSettings<PublicSettingsPayload>('WHOLESALE'),
  ]);
  const seo = layoutSeoFromSettings({
    channel: 'WHOLESALE',
    business: settings?.business,
    seo: settings?.seo,
  });
  return {
    title: { default: seo.title, template: '%s | پوشاک ترنم' },
    description: seo.description,
    openGraph: {
      type: 'website',
      locale: 'fa_IR',
      siteName: seo.siteName,
      title: seo.title,
      description: seo.description,
      images: [{ url: seo.ogImage, width: 1200, height: 630, alt: seo.ogAlt }],
    },
    ...(google ? { verification: { google } } : {}),
  };
}

function normalizeMenus(raw?: MenusSettings | null): MenusSettings {
  if (!raw) return DEFAULT_MENUS;
  return {
    ...DEFAULT_MENUS,
    ...raw,
    main: raw.main?.length ? raw.main : DEFAULT_MENUS.main,
    footer: raw.footer?.length ? raw.footer : DEFAULT_MENUS.footer,
    mobile: raw.mobile?.length
      ? raw.mobile
      : raw.main?.length
        ? raw.main
        : DEFAULT_MENUS.main,
    legal: raw.legal?.length ? raw.legal : DEFAULT_MENUS.legal,
  };
}

export default async function WholesaleLayout({ children }: { children: React.ReactNode }) {
  const [settings, chromeDoc] = await Promise.all([
    fetchPublicSettings<PublicSettingsPayload>('WHOLESALE'),
    fetchSiteContent('WHOLESALE', 'chrome', { revalidate: REVALIDATE }),
  ]);

  const chrome = chromeDoc?.blocks?.length
    ? parseChromeBlocks(chromeDoc.blocks)
    : defaultSiteChrome('WHOLESALE');

  const bag: WholesaleChromeBag = {
    theme: mergePublicTheme(settings?.theme),
    menus: normalizeMenus(settings?.menus),
    chrome,
    enamad: settings?.business?.enamadWholesale
      ? normalizeEnamad(settings.business.enamadWholesale)
      : null,
  };

  return (
    <WholesaleChromeProvider value={bag}>
      <OrganizationJsonLd
        channel="WHOLESALE"
        business={settings?.business}
        seo={settings?.seo}
        payment={settings?.payment}
      />
      <WebSiteJsonLd channel="WHOLESALE" business={settings?.business} seo={settings?.seo} />
      <GoogleAnalyticsProvider channel="WHOLESALE" />
      <ThemeRuntime theme={bag.theme} />
      <Header />
      <main>{children}</main>
      <Footer />
      <FloatingContact chrome={bag.chrome} />
      <ScrollToTop />
    </WholesaleChromeProvider>
  );
}
