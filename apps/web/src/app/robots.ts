import type { MetadataRoute } from 'next';
import { getSeoChannel } from '@/lib/seo';
import { buildRobotsRules, robotsSitemap } from '@/lib/robots-policy';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const channel = await getSeoChannel();

  return {
    rules: buildRobotsRules(),
    sitemap: robotsSitemap(channel),
  };
}
