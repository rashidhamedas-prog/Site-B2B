import { getSeoChannel } from '@/lib/seo';
import { blogSitemapUrls, sitemapXmlResponse, urlsetXml } from '@/lib/sitemap-xml';

export const revalidate = 3600;

export async function GET() {
  const channel = await getSeoChannel();
  const urls = await blogSitemapUrls(channel);
  return sitemapXmlResponse(urlsetXml(urls));
}
