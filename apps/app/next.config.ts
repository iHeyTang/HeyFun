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
        destination: '/dashboard/flowcanvas',
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
      {
        source: '/:path*',
        headers: [
          // Security headers
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
      {
        source: '/sitemap.xml',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, s-maxage=3600',
          },
        ],
      },
      {
        source: '/robots.txt',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, s-maxage=3600',
          },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
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
