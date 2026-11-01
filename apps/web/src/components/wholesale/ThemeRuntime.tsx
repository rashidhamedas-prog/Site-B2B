'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { ThemeApply } from './ThemeApply';
import {
  DEFAULT_THEME,
  mergePublicTheme,
  type ThemeSettings,
} from '@/lib/theme-settings';

interface PublicSettings {
  theme?: ThemeSettings;
}

// Renders nothing until a scroll/timer trigger, so it never contributes SSR markup.
const LandingPopups = dynamic(() => import('./LandingPopups').then((m) => m.LandingPopups), {
  ssr: false,
});

/**
 * Loads public theme settings and applies glass/color + landing popups.
 * Pass `theme` from SSR to skip the `/settings/public` network fetch.
 */
export function ThemeRuntime({ theme: preloaded }: { theme?: ThemeSettings | null } = {}) {
  const [theme, setTheme] = useState<ThemeSettings>(() =>
    preloaded ? mergePublicTheme(preloaded) : DEFAULT_THEME,
  );

  useEffect(() => {
    if (preloaded) {
      setTheme(mergePublicTheme(preloaded));
      return;
    }
    let cancelled = false;
    import('@/lib/api')
      .then(({ apiClient }) => apiClient.get<PublicSettings>('/settings/public'))
      .then((res) => {
        if (cancelled || !res?.theme) return;
        setTheme(mergePublicTheme(res.theme));
      })
      .catch(() => {
        /* keep defaults */
      });
    return () => {
      cancelled = true;
    };
  }, [preloaded]);

  return (
    <>
      <ThemeApply theme={theme} />
      <LandingPopups theme={theme} />
    </>
  );
}
