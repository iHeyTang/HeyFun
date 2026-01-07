/**
 * Browser Runtime Manager 工厂函数
 * 根据配置返回对应的 BRM 实例
 *
 * 注意：在 serverless/edge function 环境中，每次调用都创建新实例，
 * 不缓存状态，确保无状态特性
 */

import { BrowserRuntimeManager } from './runtime-manager';
import { PlaywrightBrowserRuntimeManager } from './providers/playwright';
import type { BrowserProvider } from './handle';

/**
 * 获取 Browser Runtime Manager 实例
 *
 * 在 serverless 环境中，每次调用都创建新实例，不缓存
 * 这确保每个请求都是无状态的，符合 serverless 最佳实践
 */
export function getBrowserRuntimeManager(): BrowserRuntimeManager {
  const provider = (process.env.BROWSER_PROVIDER || 'playwright') as BrowserProvider;

  switch (provider) {
    case 'playwright':
      return new PlaywrightBrowserRuntimeManager();
    default:
      throw new Error(`Unsupported browser provider: ${provider}`);
  }
}

// 导出类型和接口
export type { BrowserHandle, BrowserProvider, BrowserStatus } from './handle';
