'use client';

import { useEffect } from 'react';

export type ThemeDisplayMode = 'light' | 'dark' | 'customImage';

export interface ThemePopupConfig {
  enabled: boolean;
  trigger: 'delay' | 'exit';
  delaySeconds: number;
  title: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
}

export interface ThemeSettings {
  primaryColor: string;
  secondaryColor: string;
  displayMode: ThemeDisplayMode;
  backgroundImageUrl: string;
  glassBlurPx: number;
  popups: {
    boutique: ThemePopupConfig;
    newsletter: ThemePopupConfig;
  };
}

export const DEFAULT_THEME: ThemeSettings = {
  primaryColor: '#1B5C4A',
  secondaryColor: '#C9A84C',
  displayMode: 'light',
  backgroundImageUrl: '',
  glassBlurPx: 12,
  popups: {
    boutique: {
      enabled: true,
      trigger: 'delay',
      delaySeconds: 6,
      title: 'بوتیک دارید؟ عمده بگیرید',
      body: 'مستقیم از تولیدی ترنم در مشهد — لینن و کتان، حداقل سفارش عمده، ارسال سراسر ایران. همین حالا ثبت‌نام کنید تا لیست قیمت عمده برایتان فعال شود.',
      ctaLabel: 'ثبت‌نام عمده‌فروش',
      ctaUrl: '/portal/register',
    },
    newsletter: {
      enabled: true,
      trigger: 'exit',
      delaySeconds: 18,
      title: 'کلکسیون لینن جدید',
      body: 'قبل از اتمام موجودی فصل، از مدل‌های جدید شومیزی و مانتو لینن باخبر شوید — تماس با فروش یا عضویت از صفحه تماس.',
      ctaLabel: 'مشاوره خرید عمده',
      ctaUrl: '/contact',
    },
  },
};

function lighten(hex: string, amount: number): string {
  const n = hex.replace('#', '');
  if (n.length !== 6) return hex;
  const num = parseInt(n, 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  r = Math.min(255, Math.round(r + (255 - r) * amount));
  g = Math.min(255, Math.round(g + (255 - g) * amount));
  b = Math.min(255, Math.round(b + (255 - b) * amount));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function darken(hex: string, amount: number): string {
  const n = hex.replace('#', '');
  if (n.length !== 6) return hex;
  const num = parseInt(n, 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  r = Math.max(0, Math.round(r * (1 - amount)));
  g = Math.max(0, Math.round(g * (1 - amount)));
  b = Math.max(0, Math.round(b * (1 - amount)));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/** Applies theme CSS variables from public settings onto document root. */
export function ThemeApply({ theme }: { theme: ThemeSettings }) {
  useEffect(() => {
    const root = document.documentElement;
    const primary = theme.primaryColor || DEFAULT_THEME.primaryColor;
    const secondary = theme.secondaryColor || DEFAULT_THEME.secondaryColor;

    root.style.setProperty('--color-primary', primary);
    root.style.setProperty('--color-primary-light', lighten(primary, 0.18));
    root.style.setProperty('--color-primary-dark', darken(primary, 0.22));
    root.style.setProperty('--color-secondary', secondary);
    root.style.setProperty('--color-secondary-light', lighten(secondary, 0.22));
    root.style.setProperty('--color-secondary-dark', darken(secondary, 0.18));
    root.style.setProperty('--glass-blur', `${theme.glassBlurPx ?? 12}px`);

    if (theme.displayMode === 'dark') {
      root.style.setProperty('--color-background', '#0F1A17');
      root.style.setProperty('--color-surface', '#16241F');
      root.style.setProperty('--color-surface-muted', '#1A2C26');
      root.dataset.themeMode = 'dark';
    } else {
      root.style.setProperty('--color-background', '#FAFBF9');
      root.style.setProperty('--color-surface', '#FFFFFF');
      root.style.setProperty('--color-surface-muted', '#F3F6F4');
      root.dataset.themeMode = theme.displayMode;
    }

    if (theme.displayMode === 'customImage' && theme.backgroundImageUrl) {
      root.style.setProperty('--theme-bg-image', `url(${theme.backgroundImageUrl})`);
      document.body.classList.add('theme-custom-bg');
    } else {
      root.style.removeProperty('--theme-bg-image');
      document.body.classList.remove('theme-custom-bg');
    }

    return () => {
      document.body.classList.remove('theme-custom-bg');
    };
  }, [theme]);

  return null;
}
