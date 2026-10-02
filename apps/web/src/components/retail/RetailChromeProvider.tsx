'use client';

import { createContext, useContext, useLayoutEffect, type ReactNode } from 'react';
import type { SiteChromeData } from '@/lib/cms/chrome';
import type { EnamadSealConfig } from '@/lib/enamad';
import { seedSiteChromeCache } from '@/lib/cms/useSiteChrome';

/** Marketing IDs from public settings — optional SSR seed for RetailPixels. */
export type RetailMarketingPublic = {
  yektanetPixelId?: string;
  metaPixelId?: string;
  adroScriptUrl?: string;
  adroAccountId?: string;
  afferScriptUrl?: string;
  afsonaScriptUrl?: string;
  takhfifanScriptUrl?: string;
};

/** Compact nav rows seeded from retail layout SSR (mega menu + mobile drawer). */
export type RetailNavCategory = { id: string; name: string; slug?: string | null };
export type RetailNavCollection = { id: string; name: string; slug: string };

export type RetailChromeBag = {
  chrome: SiteChromeData;
  enamad: EnamadSealConfig | null;
  marketing: RetailMarketingPublic | null;
  skin: 'classic' | 'boutique';
  /** Instant mega-nav categories — avoids client waterfall / stuck «در حال بارگذاری». */
  navCategories?: RetailNavCategory[];
  navCollections?: RetailNavCollection[];
};

const RetailChromeContext = createContext<RetailChromeBag | null>(null);

/** SSR-fed chrome for retail layout — seeds client cache for hook fallbacks. */
export function RetailChromeProvider({
  value,
  children,
}: {
  value: RetailChromeBag;
  children: ReactNode;
}) {
  useLayoutEffect(() => {
    seedSiteChromeCache('RETAIL', value.chrome);
  }, [value.chrome]);

  return (
    <RetailChromeContext.Provider value={value}>{children}</RetailChromeContext.Provider>
  );
}

export function useRetailChrome(): RetailChromeBag | null {
  return useContext(RetailChromeContext);
}

export function useRetailSkin(): 'classic' | 'boutique' {
  return useRetailChrome()?.skin ?? 'classic';
}
