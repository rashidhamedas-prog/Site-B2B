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
import { fetchPublicSettings, getServerApiBase } from '@/lib/server-api';
import { normalizeEnamad, type EnamadSealConfig } from '@/lib/enamad';
import { resolveGscVerification } from '@/lib/google-seo';
import { parseRetailStorefrontSkin } from '@/lib/retail-storefront-skin';
import {
  catalogFetchInit,
  categoryDisplayName,
  merchandiseCategories,
} from '@/lib/catalog/category-storefront';
import {
  layoutSeoFromSettings,
  type PublicBusinessSettings,
  type PublicPaymentFlags,
  type PublicSeoSettings,
} from '@/lib/organization-from-settings';
import type { RetailNavCategory, RetailNavCollection } from '@/components/retail/RetailChromeProvider';
import './retail.css';
import '@/themes/retail-boutique/boutique.css';

const REVALIDATE = 120;

async function fetchNavCategories(): Promise<RetailNavCategory[]> {
  try {
    const res = await fetch(`${getServerApiBase()}/categories`, catalogFetchInit());
    if (!res.ok) return [];
    const all = (await res.json()) as Array<{
      id: string;
      name?: string | null;
      nameEn?: string | null;
      slug?: string | null;
    }>;
    return merchandiseCategories(Array.isArray(all) ? all : [], { maxItems: 16 }).map((c) => ({
      id: c.id,
      name: categoryDisplayName(c),
      slug: c.slug ?? null,
    }));
  } catch {
    return [];
  }
}

async function fetchNavCollections(): Promise<RetailNavCollection[]> {
  try {
    const res = await fetch(
      `${getServerApiBase()}/collections?active=1&channel=RETAIL`,
      catalogFetchInit(),
    );
    if (!res.ok) return [];
    const all = (await res.json()) as Array<{ id: string; name?: string; slug?: string }>;
    if (!Array.isArray(all)) return [];
    return all
      .filter((c) => c.id && c.slug && c.name)
      .slice(0, 8)
      .map((c) => ({ id: c.id, name: c.name!, slug: c.slug! }));
  } catch {
    return [];
  }
}

type PublicSettingsPayload = {
  business?: PublicBusinessSettings & {
    enamadWholesale?: Partial<EnamadSealConfig>;
    enamadRetail?: Partial<EnamadSealConfig>;
  };
  seo?: PublicSeoSettings;
  payment?: PublicPaymentFlags;
  marketing?: RetailMarketingPublic;
  theme?: { retailStorefrontSkin?: string };
};

export async function generateMetadata(): Promise<Metadata> {
  const [google, settings] = await Promise.all([
    resolveGscVerification('RETAIL'),
    fetchPublicSettings<PublicSettingsPayload>('RETAIL'),
  ]);
  const seo = layoutSeoFromSettings({
    channel: 'RETAIL',
    business: settings?.business,
    seo: settings?.seo,
  });
  return {
    metadataBase: new URL('https://www.poshaktaranom.ir'),
    title: {
      default: seo.title,
      template: '%s | فروشگاه ترنم',
    },
    description: seo.description,
    // NOTE: no layout-level canonical — a default here would make every page
    // without its own canonical claim the homepage URL (soft-duplicate signal).
    openGraph: {
      type: 'website',
      locale: 'fa_IR',
      url: 'https://www.poshaktaranom.ir',
      siteName: seo.siteName,
      title: seo.title,
      description: seo.description,
      images: [{ url: seo.ogImage, width: 1200, height: 630, alt: seo.ogAlt }],
    },
    twitter: {
      card: 'summary_large_image',
      title: seo.siteName,
      description: seo.description,
      images: [seo.ogImage],
    },
    robots: { index: true, follow: true },
    ...(google ? { verification: { google } } : {}),
  };
}

export default async function RetailLayout({ children }: { children: React.ReactNode }) {
  const [settings, chromeDoc, navCategories, navCollections] = await Promise.all([
    fetchPublicSettings<PublicSettingsPayload>('RETAIL'),
    fetchSiteContent('RETAIL', 'chrome', { revalidate: REVALIDATE }),
    fetchNavCategories(),
    fetchNavCollections(),
  ]);

  const chrome = chromeDoc?.blocks?.length
    ? parseChromeBlocks(chromeDoc.blocks)
    : defaultSiteChrome('RETAIL');
  const skin = parseRetailStorefrontSkin(settings?.theme?.retailStorefrontSkin);

  const bag: RetailChromeBag = {
    chrome,
    enamad: settings?.business?.enamadRetail
      ? normalizeEnamad(settings.business.enamadRetail)
      : null,
    marketing: settings?.marketing ?? null,
    skin,
    navCategories,
    navCollections,
  };

  const boutique = skin === 'boutique';
  const boutiqueChrome = boutique
    ? await Promise.all([
        import('@/themes/retail-boutique/BoutiqueHeader'),
        import('@/themes/retail-boutique/BoutiqueFooter'),
      ])
    : null;
  const Header = boutiqueChrome ? boutiqueChrome[0].BoutiqueHeader : RetailHeader;
  const Footer = boutiqueChrome ? boutiqueChrome[1].BoutiqueFooter : RetailFooter;

  return (
    <RetailChromeProvider value={bag}>
      <div
        className="retail-root flex min-h-screen min-w-0 flex-col overflow-x-clip bg-[var(--retail-bg)] text-[var(--retail-ink)]"
        data-retail-skin={skin}
      >
        <OrganizationJsonLd
          channel="RETAIL"
          business={settings?.business}
          seo={settings?.seo}
          payment={settings?.payment}
        />
        <WebSiteJsonLd channel="RETAIL" business={settings?.business} seo={settings?.seo} />
        <GoogleAnalyticsProvider channel="RETAIL" />
        <RetailPixels marketing={bag.marketing} />
        <RetailAffiliateCapture />
        <Header />
        <main id="retail-main" className="min-w-0 flex-1 overflow-x-clip">
          {children}
        </main>
        <Footer />
      </div>
    </RetailChromeProvider>
  );
}
