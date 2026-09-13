import type { Metadata } from 'next';
import { RETAIL_ORIGIN, WHOLESALE_ORIGIN, absoluteUrl } from '../seo-origins';
import { publicStorefrontPathsForCms, storefrontPathsForCms } from './revalidate-storefront';

export type CmsPageSeo = {
  title: string;
  description: string;
  ogImage: string;
  ogAlt: string;
  canonical: string;
  robots: 'index' | 'noindex';
};

export const CMS_PAGE_SEO_MAX = {
  title: 200,
  description: 320,
  ogAlt: 160,
  url: 500,
} as const;

const ALLOWED_KEYS = ['title', 'description', 'ogImage', 'ogAlt', 'canonical', 'robots'] as const;

function cleanText(raw: unknown, max: number): string {
  return String(raw ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function cleanUrl(raw: unknown): string {
  const value = cleanText(raw, CMS_PAGE_SEO_MAX.url);
  if (!value) return '';
  if (/^(javascript|data|vbscript):/i.test(value)) return '';
  if (value.startsWith('/') || /^https?:\/\//i.test(value)) return value;
  return '';
}

export function emptyCmsPageSeo(): CmsPageSeo {
  return { title: '', description: '', ogImage: '', ogAlt: '', canonical: '', robots: 'index' };
}

export function normalizeCmsPageSeo(raw: unknown): CmsPageSeo {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const robotsRaw = cleanText(src.robots, 16).toLowerCase();
  return {
    title: cleanText(src.title, CMS_PAGE_SEO_MAX.title),
    description: cleanText(src.description, CMS_PAGE_SEO_MAX.description),
    ogImage: cleanUrl(src.ogImage),
    ogAlt: cleanText(src.ogAlt, CMS_PAGE_SEO_MAX.ogAlt),
    canonical: cleanUrl(src.canonical),
    robots: robotsRaw === 'noindex' ? 'noindex' : 'index',
  };
}

export function cmsPageSeoForSave(seo: CmsPageSeo): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of ALLOWED_KEYS) {
    const value = key === 'robots' ? seo.robots : seo[key];
    if (value) out[key] = value;
  }
  return out;
}

export function cmsPageOrigin(channel: 'RETAIL' | 'WHOLESALE'): string {
  return channel === 'RETAIL' ? RETAIL_ORIGIN : WHOLESALE_ORIGIN;
}

export function cmsPagePublicPath(channel: 'RETAIL' | 'WHOLESALE', pageKey: string): string {
  if (pageKey === 'chrome') return '/';
  if (channel === 'RETAIL') {
    const publicPath = publicStorefrontPathsForCms(channel, pageKey)[0];
    return publicPath || '/';
  }
  return storefrontPathsForCms(channel, pageKey)[0] || '/';
}

export function defaultCanonical(channel: 'RETAIL' | 'WHOLESALE', pageKey: string): string {
  return absoluteUrl(cmsPageOrigin(channel), cmsPagePublicPath(channel, pageKey));
}

export function metadataFromCmsSeo(
  seo: CmsPageSeo,
  fallback: { title: string; description: string; canonical?: string; ogImage?: string; ogAlt?: string },
  channel: 'RETAIL' | 'WHOLESALE',
  pageKey: string,
): Metadata {
  const title = seo.title || fallback.title;
  const description = seo.description || fallback.description;
  const canonical = seo.canonical || fallback.canonical || defaultCanonical(channel, pageKey);
  const ogImage = seo.ogImage || fallback.ogImage || '';
  const ogAlt = seo.ogAlt || fallback.ogAlt || title;
  const indexable = seo.robots !== 'noindex';

  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: indexable, follow: indexable },
    openGraph: {
      title,
      description,
      url: canonical,
      locale: 'fa_IR',
      type: 'website',
      images: ogImage ? [{ url: ogImage, alt: ogAlt }] : undefined,
    },
    twitter: {
      card: ogImage ? 'summary_large_image' : 'summary',
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}
