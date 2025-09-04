/**
 * AIGC Providers - 统一导出所有服务商实现
 */

import { createBuiltinAigcProvider } from './builtin';

// Builtin Provider - 内置统一服务商
export {
  BuiltinAigcProvider,
  createBuiltinAigcProvider,
  BuiltinModelRegistry,
  UniversalAigcApiAdapter,
} from './builtin';

export type {
  ModelDefinition,
  ModelProviderConfig,
  ServiceAdapter,
  ModelRegistry,
} from './builtin';

// 原有单独的服务商 Providers
export { DashscopeWanProvider, dashscopeWanServiceConfigSchema } from './dashscope/wan';
export { volcengineArkServiceConfigSchema } from './volcengine/ark';
export { volcengineJimengServiceConfigSchema } from './volcengine/jimeng';

// Provider 注册表
const providers = new Map<string, any>();

// 注册 builtin provider
providers.set('builtin', createBuiltinAigcProvider);

/**
 * 获取 provider 实例
 */
export function getProvider(providerId: string): any {
  const providerFactory = providers.get(providerId);
  if (!providerFactory) {
    return null;
  }
  
  if (typeof providerFactory === 'function') {
    return providerFactory();
  }
  
  return providerFactory;
}

/**
 * 获取所有可用的 providers
 */
export function getAllProviders(): Record<string, any> {
  const result: Record<string, any> = {};
  
  for (const [providerId, providerFactory] of providers) {
    if (typeof providerFactory === 'function') {
      result[providerId] = providerFactory();
    } else {
      result[providerId] = providerFactory;
    }
  }
  
  return result;
}

/**
 * 注册新的 provider
 */
export function registerProvider(providerId: string, provider: any): void {
  providers.set(providerId, provider);
}
