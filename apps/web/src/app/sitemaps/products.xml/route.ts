import { getSeoChannel } from '@/lib/seo';
import {
  getSitemapProducts,
  productSitemapUrls,
  sitemapXmlResponse,
  urlsetXml,
} from '@/lib/sitemap-xml';

export const revalidate = 3600;

export async function GET() {
  const channel = await getSeoChannel();
  const products = await getSitemapProducts(channel);
  return sitemapXmlResponse(urlsetXml(productSitemapUrls(channel, products)));
}
