/**
 * AIGC Builtin Provider - 内置服务商统一接口
 */

import { BuiltinAigcProvider } from './provider';

// 类型定义导出
export type { ModelDefinition, ModelProviderConfig, ServiceAdapter, ModelRegistry } from './types';

// 核心类导出
export { BuiltinModelRegistry } from './registry';
export { UniversalAigcApiAdapter } from './adapters';
export { BuiltinAigcProvider } from './provider';

// 创建默认实例的工厂函数
export function createBuiltinAigcProvider(): BuiltinAigcProvider {
  return new BuiltinAigcProvider();
}
