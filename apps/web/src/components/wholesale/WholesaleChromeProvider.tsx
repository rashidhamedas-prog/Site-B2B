'use client';

import { createContext, useContext, useLayoutEffect, type ReactNode } from 'react';
import type { ThemeSettings } from '@/lib/theme-settings';
import type { MenusSettings } from '@/lib/menus';
import type { SiteChromeData } from '@/lib/cms/chrome';
import type { EnamadSealConfig } from '@/lib/enamad';
import { seedMenusCache } from '@/lib/hooks/useMenus';
import { seedSiteChromeCache } from '@/lib/cms/useSiteChrome';

export type WholesaleChromeBag = {
  theme: ThemeSettings;
  menus: MenusSettings;
  chrome: SiteChromeData;
  enamad: EnamadSealConfig | null;
};

const WholesaleChromeContext = createContext<WholesaleChromeBag | null>(null);

/** SSR-fed chrome for wholesale layout — seeds client caches for hook fallbacks. */
export function WholesaleChromeProvider({
  value,
  children,
}: {
  value: WholesaleChromeBag;
  children: ReactNode;
}) {
  useLayoutEffect(() => {
    seedMenusCache(value.menus);
    seedSiteChromeCache('WHOLESALE', value.chrome);
  }, [value.menus, value.chrome]);

  return (
    <WholesaleChromeContext.Provider value={value}>{children}</WholesaleChromeContext.Provider>
  );
}

export function useWholesaleChrome(): WholesaleChromeBag | null {
  return useContext(WholesaleChromeContext);
}
