import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  compress: true,

  images: {
    formats: ['image/webp', 'image/avif'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'poshaktaranom.com',
        pathname: '/media/**',
      },
      {
        protocol: 'https',
        hostname: 'www.poshaktaranom.ir',
        pathname: '/media/**',
      },
      {
        protocol: 'https',
        hostname: 'poshaktaranom.ir',
        pathname: '/media/**',
      },
      {
        protocol: 'https',
        hostname: 'api.poshaktaranom.com',
        pathname: '/media/**',
      },
      {
        protocol: 'https',
        hostname: 'storage.poshaktaranom.com',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '9000',
        pathname: '/**',
      },
    ],
    deviceSizes: [375, 640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Transpile workspace packages
  transpilePackages: ['@taranom/shared-types', '@taranom/persian-utils'],

  // Serve search/preview bots blocking (non-streamed) HTML so notFound() in
  // generateMetadata yields a real 404 status (streamed shells always flush
  // 200 first). Regular browsers keep fast streaming. Extends the Next
  // default HTML-limited bot list with the major search crawlers.
  htmlLimitedBots:
    /Googlebot|Google-InspectionTool|AdsBot-Google|Storebot-Google|Bingbot|BingPreview|Slurp|DuckDuckBot|baiduspider|yandex|sogou|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Applebot|ia_archiver|Mediapartners-Google|TorobBot|Torob-Bot/i,

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },

  // Legacy WordPress / Yoast sitemap paths → current Next.js sitemap
  async redirects() {
    return [
      { source: '/sitemap_index.xml', destination: '/sitemap.xml', permanent: true },
      { source: '/product-sitemap.xml', destination: '/sitemap.xml', permanent: true },
      { source: '/page-sitemap.xml', destination: '/sitemap.xml', permanent: true },
      { source: '/post-sitemap.xml', destination: '/sitemap.xml', permanent: true },
      { source: '/category-sitemap.xml', destination: '/sitemap.xml', permanent: true },
      { source: '/local-sitemap.xml', destination: '/sitemap.xml', permanent: true },
    ];
  },

  experimental: {
    optimizePackageImports: ['lucide-react', 'chart.js'],
  },
};

export default nextConfig;
