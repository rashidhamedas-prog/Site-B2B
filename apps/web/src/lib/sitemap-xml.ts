import { fetchSitemapPosts } from '@/lib/blog';
import { publicProductUrl } from '@/lib/public-product-path';
import { getServerApiBase } from '@/lib/server-api';
import { RETAIL_ORIGIN, WHOLESALE_ORIGIN } from '@/lib/seo';

export type SitemapChannel = 'WHOLESALE' | 'RETAIL';

export interface SitemapProductRow {
  slug?: string | null;
  updatedAt?: string;
  status?: string;
  robotsIndex?: boolean;
}

export interface SitemapCategoryRow {
  slug?: string | null;
  updatedAt?: string;
  status?: string;
  isIndexable?: boolean;
}

export interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
}

const BLOCKED_PATH =
  /\/(cart|checkout|login|admin|portal|search|account|payment|retail)(\/|$)/i;

export function sitemapOrigin(channel: SitemapChannel): string {
  return channel === 'RETAIL' ? RETAIL_ORIGIN : WHOLESALE_ORIGIN;
}

export function escapeXml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function lastmodFrom(value?: string | Date | null): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString().slice(0, 10);
}

export function isIndexableLoc(loc: string): boolean {
  try {
    const url = new URL(loc);
    if (url.protocol !== 'https:') return false;
    if (url.search || url.hash) return false;
    if (BLOCKED_PATH.test(url.pathname)) return false;
    if (url.pathname.includes('/products/fabric/')) return false;
    return true;
  } catch {
    return false;
  }
}

export function urlsetXml(entries: SitemapUrl[]): string {
  const body = entries
    .filter((entry) => entry.loc && isIndexableLoc(entry.loc))
    .map((entry) => {
      const parts = [`<loc>${escapeXml(entry.loc)}</loc>`];
      if (entry.lastmod) parts.push(`<lastmod>${escapeXml(entry.lastmod)}</lastmod>`);
      if (entry.changefreq) {
        parts.push(`<changefreq>${escapeXml(entry.changefreq)}</changefreq>`);
      }
      if (entry.priority) parts.push(`<priority>${escapeXml(entry.priority)}</priority>`);
      return `<url>${parts.join('')}</url>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`;
}

export function sitemapXmlResponse(xml: string): Response {
  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}

export async function getSitemapProducts(
  channel: SitemapChannel,
): Promise<SitemapProductRow[]> {
  try {
    const response = await fetch(
      `${getServerApiBase()}/products?limit=500&channel=${channel}&status=ACTIVE`,
      { next: { revalidate: 3600 } },
    );
    if (!response.ok) return [];
    const json = await response.json();
    const data = json.data ?? json ?? [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function getSitemapCategories(): Promise<SitemapCategoryRow[]> {
  try {
    const response = await fetch(`${getServerApiBase()}/categories`, {
      next: { revalidate: 3600 },
    });
    if (!response.ok) return [];
    const json = await response.json();
    const data = Array.isArray(json) ? json : json.data ?? [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function productSitemapUrls(
  channel: SitemapChannel,
  products: SitemapProductRow[],
): SitemapUrl[] {
  const origin = sitemapOrigin(channel);
  return products
    .filter((product) => product?.slug && product.robotsIndex !== false)
    .map((product) => {
      const slug = String(product.slug);
      const loc =
        channel === 'RETAIL'
          ? publicProductUrl(slug, origin)
          : `${origin}/products/${slug}`;
      return {
        loc,
        lastmod: lastmodFrom(product.updatedAt),
        changefreq: 'weekly',
        priority: '0.8',
      };
    });
}

export async function blogSitemapUrls(channel: SitemapChannel): Promise<SitemapUrl[]> {
  const origin = sitemapOrigin(channel);
  const posts = await fetchSitemapPosts(channel);
  return posts
    .filter((post) => post?.slug && post.robotsIndex !== false)
    .map((post) => ({
      loc: `${origin}/blog/${post.slug}`,
      lastmod: lastmodFrom(post.updatedAt || post.publishedAt),
      changefreq: post.sitemapChangeFrequency || 'monthly',
      priority:
        typeof post.sitemapPriority === 'number' ? String(post.sitemapPriority) : '0.55',
    }));
}

export function categorySitemapUrls(
  channel: SitemapChannel,
  categories: SitemapCategoryRow[],
): SitemapUrl[] {
  const origin = sitemapOrigin(channel);
  return categories
    .filter(
      (category) =>
        category?.slug &&
        category.isIndexable !== false &&
        String(category.status || 'ACTIVE').toUpperCase() !== 'HIDDEN',
    )
    .map((category) => ({
      loc: `${origin}/category/${category.slug}`,
      lastmod: lastmodFrom(category.updatedAt),
      changefreq: 'weekly',
      priority: '0.75',
    }));
}

export function pageSitemapUrls(channel: SitemapChannel): SitemapUrl[] {
  const origin = sitemapOrigin(channel);
  const retail: SitemapUrl[] = [
    { loc: origin, changefreq: 'daily', priority: '1.0' },
    { loc: `${origin}/products`, changefreq: 'daily', priority: '0.9' },
    { loc: `${origin}/collections`, changefreq: 'weekly', priority: '0.75' },
    { loc: `${origin}/blog`, changefreq: 'weekly', priority: '0.65' },
    { loc: `${origin}/about`, changefreq: 'monthly', priority: '0.6' },
    { loc: `${origin}/contact`, changefreq: 'monthly', priority: '0.6' },
    { loc: `${origin}/shipping`, changefreq: 'monthly', priority: '0.45' },
    { loc: `${origin}/returns`, changefreq: 'monthly', priority: '0.45' },
  ];
  const wholesale: SitemapUrl[] = [
    { loc: origin, changefreq: 'daily', priority: '1.0' },
    { loc: `${origin}/products`, changefreq: 'daily', priority: '0.9' },
    { loc: `${origin}/linen-collection`, changefreq: 'weekly', priority: '0.85' },
    { loc: `${origin}/workshop`, changefreq: 'monthly', priority: '0.65' },
    { loc: `${origin}/wholesale`, changefreq: 'weekly', priority: '0.8' },
    { loc: `${origin}/about`, changefreq: 'monthly', priority: '0.7' },
    { loc: `${origin}/contact`, changefreq: 'monthly', priority: '0.7' },
    { loc: `${origin}/blog`, changefreq: 'weekly', priority: '0.65' },
    { loc: `${origin}/wholesale-manto-mashhad`, changefreq: 'weekly', priority: '0.85' },
    { loc: `${origin}/shipping`, changefreq: 'monthly', priority: '0.4' },
    { loc: `${origin}/returns`, changefreq: 'monthly', priority: '0.4' },
    { loc: `${origin}/privacy`, changefreq: 'yearly', priority: '0.3' },
    { loc: `${origin}/terms`, changefreq: 'yearly', priority: '0.3' },
  ];
  return channel === 'RETAIL' ? retail : wholesale;
}
