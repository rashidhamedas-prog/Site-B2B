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

export function mergePublicTheme(raw?: ThemeSettings | null): ThemeSettings {
  if (!raw) return DEFAULT_THEME;
  return {
    ...DEFAULT_THEME,
    ...raw,
    popups: {
      boutique: { ...DEFAULT_THEME.popups.boutique, ...raw.popups?.boutique },
      newsletter: { ...DEFAULT_THEME.popups.newsletter, ...raw.popups?.newsletter },
    },
  };
}
