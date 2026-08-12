'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { ThemeApply } from './ThemeApply';
import { LandingPopups } from './LandingPopups';
import {
  DEFAULT_THEME,
  mergePublicTheme,
  type ThemeSettings,
} from '@/lib/theme-settings';

interface PublicSettings {
  theme?: ThemeSettings;
}

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
    apiClient
      .get<PublicSettings>('/settings/public')
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
