import { RETAIL_ORIGIN, WHOLESALE_ORIGIN } from './seo-origins';

export type PublicSite = 'retail' | 'wholesale';

export function siteOrigin(site: PublicSite): string {
  return site === 'retail' ? RETAIL_ORIGIN : WHOLESALE_ORIGIN;
}

export function getProductCanonicalPath(slug: string): string {
  const s = String(slug || '').replace(/^\/+|\/+$/g, '');
  return `/products/${s}`;
}

export function getProductCanonicalUrl(
  product: { slug?: string | null },
  site: PublicSite,
): string {
  return `${siteOrigin(site)}${getProductCanonicalPath(String(product.slug || ''))}`;
}

export function getCategoryCanonicalPath(slug: string): string {
  const s = String(slug || '').replace(/^\/+|\/+$/g, '');
  return `/category/${s}`;
}

export function getCategoryCanonicalUrl(slug: string, site: PublicSite): string {
  return `${siteOrigin(site)}${getCategoryCanonicalPath(slug)}`;
}

export function getBlogCanonicalUrl(slug: string, site: PublicSite): string {
  return `${siteOrigin(site)}/blog/${String(slug || '').replace(/^\/+|\/+$/g, '')}`;
}
