import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';
import path from 'path';

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@repo/llm', '@repo/ui'],
  webpack: (config, { isServer }) => {
    // 添加根目录 node_modules 到解析路径
    config.resolve.modules = [...(config.resolve.modules || []), path.resolve(__dirname, '../../node_modules')];

    // 确保正确解析 workspace 包
    config.resolve.alias = {
      ...config.resolve.alias,
      '@repo/llm/chat': path.resolve(__dirname, '../../packages/llm/src/chat/index.ts'),
      '@repo/llm/aigc': path.resolve(__dirname, '../../packages/llm/src/aigc/index.ts'),
      '@repo/llm': path.resolve(__dirname, '../../packages/llm/src'),
    };

    // 支持导入 .template.md 文件作为原始字符串
    // 支持两种方式：直接导入和 ?raw 查询参数
    config.module.rules.push({
      test: /\.template\.md$/,
      type: 'asset/source', // 使用 asset/source 类型，将文件内容作为字符串导入
    });

    // 支持导入 .py 文件作为原始字符串（用于浏览器脚本）
    // 使用 resourceQuery 匹配 ?raw 查询参数
    // 注意：这个规则需要在其他规则之前，确保优先匹配
    config.module.rules.unshift({
      test: /\.py$/,
      type: 'asset/source', // 使用 asset/source 类型，将文件内容作为字符串导入
    });

    return config;
  },
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
        destination: '/dashboard/agent',
        permanent: true,
      },
      {
        source: '/dashboard/settings',
        destination: '/dashboard/settings/voices',
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
