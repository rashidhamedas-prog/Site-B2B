import type { MetadataRoute } from 'next';
import { getSeoChannel, RETAIL_ORIGIN, WHOLESALE_ORIGIN } from '@/lib/seo';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const channel = await getSeoChannel();

  if (channel === 'RETAIL') {
    return {
      rules: [
        {
          userAgent: '*',
          allow: '/',
          disallow: [
            '/admin/',
            '/portal/',
            '/api/',
            '/checkout',
            '/account',
            '/wholesale',
            '/blog',
            '/linen-collection',
            '/workshop',
            '/retail/',
          ],
        },
      ],
      sitemap: `${RETAIL_ORIGIN}/sitemap.xml`,
      host: RETAIL_ORIGIN,
    };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/portal/', '/api/', '/checkout', '/account', '/retail/'],
      },
    ],
    sitemap: `${WHOLESALE_ORIGIN}/sitemap.xml`,
    host: WHOLESALE_ORIGIN,
  };
}
