import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    unoptimized: false,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    formats: ['image/webp'],
    minimumCacheTTL: 60,
    remotePatterns: [
      {
        protocol: 'http',
        hostname: '**',
        pathname: '/api/workspace/**',
      },
      {
        protocol: 'https',
        hostname: '**',
        pathname: '/api/workspace/**',
      },
    ],
  },
  /* config options here */
  async rewrites() {
    return [
      {
        source: '/',
        destination: '/tasks',
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/api/heyfun/tasks/:task_id/events',
        headers: [
          { key: 'Connection', value: 'keep-alive' },
          { key: 'Cache-Control', value: 'no-cache' },
          { key: 'Content-Type', value: 'text/event-stream' },
        ],
      },
    ];
  },
};

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);
