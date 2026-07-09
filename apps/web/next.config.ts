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
        hostname: '*.poshaktaranom.com',
      },
      {
        protocol: 'https',
        hostname: '*.poshaktaranom.ir',
      },
      // MinIO / object storage
      {
        protocol: 'https',
        hostname: 'storage.poshaktaranom.com',
      },
      // Local development MinIO
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '9000',
      },
    ],
    deviceSizes: [375, 640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Transpile workspace packages
  transpilePackages: ['@taranom/shared-types', '@taranom/persian-utils'],

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

  // Redirects: .ir → wholesale area if needed in future
  async redirects() {
    return [];
  },

  experimental: {
    optimizePackageImports: ['lucide-react', 'chart.js'],
  },
};

export default nextConfig;
