/** @type {import('next').NextConfig} */
const nextConfig = {
  // 启用 source maps 用于生产环境错误追踪
  productionBrowserSourceMaps: true,
  // 可选：启用服务器端 source maps
  experimental: {
    serverSourceMaps: true,
  },
};

export default nextConfig;
