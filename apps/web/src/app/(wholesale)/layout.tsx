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
import { getServerApiBase } from '@/lib/server-api';
import { normalizeEnamad, type EnamadSealConfig } from '@/lib/enamad';
import { mergePublicTheme, type ThemeSettings } from '@/lib/theme-settings';

const REVALIDATE = 120;

type PublicSettingsPayload = {
  theme?: ThemeSettings;
  menus?: MenusSettings;
  business?: {
    enamadWholesale?: Partial<EnamadSealConfig>;
    enamadRetail?: Partial<EnamadSealConfig>;
  };
};

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

async function fetchWholesalePublicSettings(): Promise<PublicSettingsPayload | null> {
  try {
    const base = getServerApiBase();
    const res = await fetch(`${base}/settings/public?channel=WHOLESALE`, {
      next: { revalidate: REVALIDATE },
    });
    if (!res.ok) return null;
    return (await res.json()) as PublicSettingsPayload;
  } catch {
    return null;
  }
}

export default async function WholesaleLayout({ children }: { children: React.ReactNode }) {
  const [settings, chromeDoc] = await Promise.all([
    fetchWholesalePublicSettings(),
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
      <OrganizationJsonLd channel="WHOLESALE" />
      <WebSiteJsonLd channel="WHOLESALE" />
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
