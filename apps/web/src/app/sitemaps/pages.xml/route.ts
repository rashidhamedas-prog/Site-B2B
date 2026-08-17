import { getSeoChannel } from '@/lib/seo';
import { pageSitemapUrls, sitemapXmlResponse, urlsetXml } from '@/lib/sitemap-xml';

export const revalidate = 3600;

export async function GET() {
  const channel = await getSeoChannel();
  return sitemapXmlResponse(urlsetXml(pageSitemapUrls(channel)));
}
