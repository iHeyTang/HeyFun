/**
 * Sandbox Runtime Manager 工厂函数
 * 根据配置返回对应的 SRM 实例
 *
 * 注意：在 serverless/edge function 环境中，每次调用都创建新实例，
 * 不缓存状态，确保无状态特性
 */

import { SandboxRuntimeManager } from './runtime-manager';
import { DaytonaSandboxRuntimeManager } from './providers/daytona';
import { E2BSandboxRuntimeManager } from './providers/e2b';
import { SandboxProvider } from './handle';

/**
 * 获取 Sandbox Runtime Manager 实例
 *
 * 在 serverless 环境中，每次调用都创建新实例，不缓存
 * 这确保每个请求都是无状态的，符合 serverless 最佳实践
 */
export function getSandboxRuntimeManager(): SandboxRuntimeManager {
  const provider = (process.env.SANDBOX_PROVIDER || 'daytona') as SandboxProvider;

  switch (provider) {
    case 'daytona':
      return new DaytonaSandboxRuntimeManager();
    case 'e2b':
      return new E2BSandboxRuntimeManager();
    default:
      throw new Error(`Unsupported sandbox provider: ${provider}`);
  }
}

// 导出类型和接口
export type { SandboxHandle, SandboxProvider, SandboxStatus, SandboxCostProfile } from './handle';
export type { SandboxRuntimeManager, SandboxExecResult } from './runtime-manager';

