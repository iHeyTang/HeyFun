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
  async redirects() {
    return [
      {
        source: '/dashboard',
        destination: '/dashboard/chat',
        permanent: true,
      },
      {
        source: '/dashboard/settings',
        destination: '/dashboard/settings/llm',
        permanent: true,
      },
      {
        source: '/dashboard/settings/llm',
        destination: '/dashboard/settings/llm/deepseek',
        permanent: true,
      },
      {
        source: '/dashboard/settings/aigc',
        destination: '/dashboard/settings/aigc/doubao',
        permanent: true,
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
  serverRuntimeConfig: {
    PORT: process.env.PORT || 4011,
  },
};

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);
