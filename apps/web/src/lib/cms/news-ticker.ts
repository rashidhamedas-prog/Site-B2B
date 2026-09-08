import type { SiteChromeData } from './chrome';

export const STOREFRONT_HERO_FRAME_CLASS = 'storefront-hero-frame';

const WHOLESALE_TICKER = [
  'ارسال به سراسر ایران از دفتر پخش مشهد',
  'حداقل سفارش هر مدل از ۶ عدد',
  'تولیدی لینن و کتان از سال ۱۳۹۴',
  'تماس فروش: ۰۹۱۵-۲۴۲-۴۶۲۴',
];

const RETAIL_TICKER = [
  'خرید تکی از همان کارگاه مشهد',
  'ارسال از تولیدی — تعویض سایز از حساب کاربری',
  'شومیز، کت، کاپشن و کفتان',
  'پرداخت امن زرین‌پال',
];

export function defaultTickerItems(channel: 'WHOLESALE' | 'RETAIL'): string[] {
  return channel === 'RETAIL' ? [...RETAIL_TICKER] : [...WHOLESALE_TICKER];
}

function splitTickerSource(raw: string): string[] {
  return raw
    .split(/\r?\n| — |\s\|\s/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 6);
}

/** CMS ticker lines, then announcement text splits, then verified channel defaults. */
export function resolveTickerItems(
  announcement: SiteChromeData['announcement'] | undefined,
  channel: 'WHOLESALE' | 'RETAIL',
): string[] {
  if (announcement && announcement.enabled === false) return [];

  const fromItems = (announcement?.tickerItems ?? [])
    .map((item) => item.trim())
    .filter(Boolean);
  if (fromItems.length) return fromItems;

  const fromText = announcement?.text ? splitTickerSource(announcement.text) : [];
  if (fromText.length >= 2) return fromText;

  const defaults = defaultTickerItems(channel);
  if (fromText.length === 1) {
    return [fromText[0]!, ...defaults.filter((item) => item !== fromText[0])];
  }
  return defaults;
}

export function isStorefrontHomePath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return pathname === '/' || pathname === '/retail';
}
