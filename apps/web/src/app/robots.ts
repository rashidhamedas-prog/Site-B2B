import type { MetadataRoute } from 'next';
import {
  getSeoChannel,
  RETAIL_ORIGIN,
  WHOLESALE_ORIGIN,
} from '@/lib/seo';

const COMMON_DISALLOW = [
  '/admin/',
  '/portal/',
  '/api/',
  '/checkout',
  '/account',
  '/blog/search',
  '/blog/preview',
];

export default async function robots(): Promise<MetadataRoute.Robots> {
  const channel = await getSeoChannel();

  const origin =
    channel === 'RETAIL' ? RETAIL_ORIGIN : WHOLESALE_ORIGIN;

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/api/v1/feeds/'],
        disallow: COMMON_DISALLOW,
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
  };
}