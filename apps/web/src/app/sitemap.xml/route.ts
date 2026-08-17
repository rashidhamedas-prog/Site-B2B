import { getSeoChannel } from '@/lib/seo';
import { escapeXml, sitemapOrigin, sitemapXmlResponse } from '@/lib/sitemap-xml';

export const revalidate = 3600;

export async function GET() {
  const channel = await getSeoChannel();
  const origin = sitemapOrigin(channel);
  const children = [
    '/sitemaps/pages.xml',
    '/sitemaps/products.xml',
    '/sitemaps/categories.xml',
    '/sitemaps/blog.xml',
  ];

  const body = children
    .map((path) => `<sitemap><loc>${escapeXml(`${origin}${path}`)}</loc></sitemap>`)
    .join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</sitemapindex>`;
  return sitemapXmlResponse(xml);
}
