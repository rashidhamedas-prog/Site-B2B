import { getSeoChannel } from '@/lib/seo';
import {
  categorySitemapUrls,
  getSitemapCategories,
  sitemapXmlResponse,
  urlsetXml,
} from '@/lib/sitemap-xml';

export const revalidate = 3600;

export async function GET() {
  const channel = await getSeoChannel();
  const categories = await getSitemapCategories();
  return sitemapXmlResponse(urlsetXml(categorySitemapUrls(channel, categories)));
}
