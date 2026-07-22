'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { ThemeApply, DEFAULT_THEME, type ThemeSettings } from './ThemeApply';
import { LandingPopups } from './LandingPopups';

interface PublicSettings {
  theme?: ThemeSettings;
}

/** Loads public theme settings and applies glass/color + landing popups. */
export function ThemeRuntime() {
  const [theme, setTheme] = useState<ThemeSettings>(DEFAULT_THEME);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<PublicSettings>('/settings/public')
      .then((res) => {
        if (cancelled || !res?.theme) return;
        setTheme({
          ...DEFAULT_THEME,
          ...res.theme,
          popups: {
            boutique: { ...DEFAULT_THEME.popups.boutique, ...res.theme.popups?.boutique },
            newsletter: { ...DEFAULT_THEME.popups.newsletter, ...res.theme.popups?.newsletter },
          },
        });
      })
      .catch(() => {
        /* keep defaults */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <ThemeApply theme={theme} />
      <LandingPopups theme={theme} />
    </>
  );
}
