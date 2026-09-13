const TITLE_MAX = 70;
const DESCRIPTION_MAX = 200;
const ALT_MAX = 160;

export type SeoChannelFields = {
  defaultTitle: string;
  defaultDescription: string;
  ogImageUrl: string;
  ogImageAlt: string;
};

export type SeoSettings = {
  wholesale: SeoChannelFields;
  retail: SeoChannelFields;
};

function stripText(raw: unknown, max: number): string {
  return String(raw ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/** Public asset URL: site-relative path or https only. */
export function sanitizePublicAssetUrl(raw: unknown): string {
  const value = String(raw ?? '').trim();
  if (!value) return '';
  if (value.startsWith('/') && !value.startsWith('//') && !/[\s"'()\\]/.test(value)) {
    if (/[<>]/.test(value)) return '';
    return value.slice(0, 300);
  }
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return '';
    return url.toString().slice(0, 300);
  } catch {
    return '';
  }
}

export function sanitizeSameAsList(raw: unknown): string[] {
  const src = Array.isArray(raw) ? raw : String(raw ?? '').split(/[\n,]/);
  const out: string[] = [];
  for (const item of src) {
    const url = sanitizePublicAssetUrl(item);
    if (url.startsWith('https://') && !out.includes(url)) out.push(url);
    if (out.length >= 8) break;
  }
  return out;
}

function channelFields(raw: unknown, fallback: SeoChannelFields): SeoChannelFields {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    defaultTitle: stripText(src.defaultTitle ?? fallback.defaultTitle, TITLE_MAX),
    defaultDescription: stripText(src.defaultDescription ?? fallback.defaultDescription, DESCRIPTION_MAX),
    ogImageUrl: sanitizePublicAssetUrl(src.ogImageUrl) || fallback.ogImageUrl,
    ogImageAlt: stripText(src.ogImageAlt ?? fallback.ogImageAlt, ALT_MAX),
  };
}

export const DEFAULT_SEO: SeoSettings = {
  wholesale: {
    defaultTitle: 'پوشاک ترنم | تولیدی مانتو زنانه مشهد',
    defaultDescription:
      'تولیدی مانتو شومیزی زنانه لینن و کتان در مشهد. فروش عمده به بوتیک‌ها در سراسر ایران.',
    ogImageUrl: '/og-wholesale.jpg',
    ogImageAlt: 'پوشاک ترنم — تولیدی مانتو زنانه مشهد',
  },
  retail: {
    defaultTitle: 'فروشگاه پوشاک ترنم | خرید آنلاین مانتو',
    defaultDescription:
      'مانتو و شومیز را تکی، مستقیم از تولیدی ترنم در مشهد بخرید. ارسال سریع، پرداخت امن و امکان تعویض سایز.',
    ogImageUrl: '/og-retail.jpg',
    ogImageAlt: 'فروشگاه پوشاک ترنم',
  },
};

export function resolveSeoSettings(raw: unknown): SeoSettings {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
  return {
    wholesale: channelFields(src.wholesale, DEFAULT_SEO.wholesale),
    retail: channelFields(src.retail, DEFAULT_SEO.retail),
  };
}

export function sanitizeBusinessSeoFields(value: Record<string, unknown>): Record<string, unknown> {
  return {
    ...value,
    logoUrl: sanitizePublicAssetUrl(value.logoUrl),
    logoAlt: stripText(value.logoAlt, ALT_MAX),
    descriptionWholesale: stripText(value.descriptionWholesale, DESCRIPTION_MAX),
    descriptionRetail: stripText(value.descriptionRetail, DESCRIPTION_MAX),
    sameAs: sanitizeSameAsList(value.sameAs),
  };
}
