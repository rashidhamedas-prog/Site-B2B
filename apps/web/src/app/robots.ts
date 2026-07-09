import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/portal/', '/api/', '/checkout'],
      },
    ],
    sitemap: 'https://poshaktaranom.com/sitemap.xml',
    host: 'https://poshaktaranom.com',
  };
}
